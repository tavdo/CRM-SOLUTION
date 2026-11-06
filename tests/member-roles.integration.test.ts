import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import type { Role } from "@prisma/client";
import type { WorkspaceContext } from "../src/lib/auth/workspace";

const fixture = vi.hoisted(() => ({
  file: `${process.cwd().replaceAll("\\", "/")}/prisma/member-roles-test-${process.pid}-${Date.now()}.db`,
  ctx: undefined as WorkspaceContext | undefined,
}));

vi.mock("../src/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: `file:${fixture.file}` }) };
});
vi.mock("../src/lib/auth/workspace", async () => {
  const { assertCan } = await import("../src/lib/permissions");
  return {
    requireWorkspace: async () => fixture.ctx!,
    requireCapability: async (capability: Parameters<typeof assertCan>[1]) => {
      assertCan(fixture.ctx!.role, capability);
      return fixture.ctx!;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../src/lib/auth/session", () => ({ createSession: vi.fn(), setActiveWorkspace: vi.fn() }));
vi.mock("../src/lib/email", () => ({ sendMail: vi.fn(), mailConfiguration: vi.fn() }));

import { prisma } from "../src/lib/db";
import { updateMemberRole, updateMemberRoles } from "../src/lib/services/members";
import { updateMemberRolesAction } from "../src/app/actions/crm";
import { revalidatePath } from "next/cache";

type RoleChange = { membershipId: string; role: Role };

async function workspace() {
  const sequence = await prisma.company.count();
  const company = await prisma.company.create({
    data: { name: "Member role test", slug: `member-roles-${sequence}` },
  });
  const contexts = {} as Record<Role, WorkspaceContext>;
  for (const role of ["ADMIN", "MANAGER", "EMPLOYEE"] as const) {
    const user = await prisma.user.create({
      data: { name: role, email: `${company.id}-${role}@test.local`, passwordHash: "test-only" },
    });
    const membership = await prisma.membership.create({ data: { companyId: company.id, userId: user.id, role } });
    contexts[role] = { company, user, membership, role, subscription: null };
  }
  return contexts;
}

async function roles(companyId: string) {
  return prisma.membership.findMany({
    where: { companyId },
    select: { id: true, role: true },
    orderBy: { id: "asc" },
  });
}

async function roleAudits(companyId: string) {
  return prisma.auditEvent.findMany({ where: { companyId, action: "member.role_changed" } });
}

describe("batch member role changes with an isolated migrated database", () => {
  beforeAll(async () => {
    for (const migration of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort()) {
      const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8");
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
  }, 40000);

  afterAll(async () => {
    await prisma.$disconnect();
    for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(fixture.file + suffix, { force: true });
  });

  it("saves several role changes together and only audits changed roles", async () => {
    const members = await workspace();
    const ctx = members.ADMIN;
    const changes: RoleChange[] = [
      { membershipId: ctx.membership.id, role: "ADMIN" },
      { membershipId: members.MANAGER.membership.id, role: "EMPLOYEE" },
      { membershipId: members.EMPLOYEE.membership.id, role: "MANAGER" },
    ];

    await updateMemberRoles(ctx, changes);
    expect(await roles(ctx.company.id)).toEqual(expect.arrayContaining(changes.map(({ membershipId, role }) => ({ id: membershipId, role }))));
    const audit = await roleAudits(ctx.company.id);
    expect(audit).toHaveLength(2);
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: members.MANAGER.membership.id, actorId: ctx.user.id, detail: JSON.stringify({ from: "MANAGER", to: "EMPLOYEE" }) }),
      expect.objectContaining({ entityId: members.EMPLOYEE.membership.id, actorId: ctx.user.id, detail: JSON.stringify({ from: "EMPLOYEE", to: "MANAGER" }) }),
    ]));

    await updateMemberRoles(ctx, changes);
    expect(await roleAudits(ctx.company.id)).toHaveLength(2);
  });

  it("allows the only administrator to hand over access in the same save", async () => {
    const members = await workspace();
    await updateMemberRoles(members.ADMIN, [
      { membershipId: members.ADMIN.membership.id, role: "EMPLOYEE" },
      { membershipId: members.MANAGER.membership.id, role: "ADMIN" },
    ]);

    expect(await prisma.membership.findUniqueOrThrow({ where: { id: members.ADMIN.membership.id } })).toMatchObject({ role: "EMPLOYEE" });
    expect(await prisma.membership.findUniqueOrThrow({ where: { id: members.MANAGER.membership.id } })).toMatchObject({ role: "ADMIN" });
    expect(await prisma.membership.count({ where: { companyId: members.ADMIN.company.id, role: "ADMIN" } })).toBe(1);
    expect(await roleAudits(members.ADMIN.company.id)).toHaveLength(2);
  });

  it("rejects removing every administrator without saving other edits or audits", async () => {
    const members = await workspace();
    await prisma.membership.update({ where: { id: members.MANAGER.membership.id }, data: { role: "ADMIN" } });
    const before = await roles(members.ADMIN.company.id);

    await expect(updateMemberRoles(members.ADMIN, [
      { membershipId: members.EMPLOYEE.membership.id, role: "MANAGER" },
      { membershipId: members.ADMIN.membership.id, role: "EMPLOYEE" },
      { membershipId: members.MANAGER.membership.id, role: "EMPLOYEE" },
    ])).rejects.toMatchObject({ code: "LAST_ADMIN", status: 400 });
    expect(await roles(members.ADMIN.company.id)).toEqual(before);
    expect(await roleAudits(members.ADMIN.company.id)).toHaveLength(0);
  });

  it.each(["foreign", "missing"] as const)("rejects a %s membership without partially saving the batch", async (kind) => {
    const members = await workspace();
    const foreign = await workspace();
    const before = await roles(members.ADMIN.company.id);
    const foreignBefore = await roles(foreign.ADMIN.company.id);

    await expect(updateMemberRoles(members.ADMIN, [
      { membershipId: members.EMPLOYEE.membership.id, role: "MANAGER" },
      { membershipId: kind === "foreign" ? foreign.EMPLOYEE.membership.id : "missing-membership", role: "ADMIN" },
    ])).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(await roles(members.ADMIN.company.id)).toEqual(before);
    expect(await roles(foreign.ADMIN.company.id)).toEqual(foreignBefore);
    expect(await roleAudits(members.ADMIN.company.id)).toHaveLength(0);
  });

  it.each(["empty batch", "empty ID", "duplicate ID", "invalid role"])("rejects %s before saving any edits", async (kind) => {
    const members = await workspace();
    const valid: RoleChange = { membershipId: members.EMPLOYEE.membership.id, role: "MANAGER" };
    const input: Record<string, RoleChange[]> = {
      "empty batch": [],
      "empty ID": [valid, { membershipId: "", role: "ADMIN" }],
      "duplicate ID": [valid, { ...valid, role: "ADMIN" }],
      "invalid role": [valid, { membershipId: members.MANAGER.membership.id, role: "OWNER" as Role }],
    };
    const before = await roles(members.ADMIN.company.id);

    await expect(updateMemberRoles(members.ADMIN, input[kind])).rejects.toMatchObject({ code: "INVALID_ROLES", status: 400 });
    expect(await roles(members.ADMIN.company.id)).toEqual(before);
    expect(await roleAudits(members.ADMIN.company.id)).toHaveLength(0);
  });

  it.each(["MANAGER", "EMPLOYEE"] as const)("blocks %s role changes at both the service and action", async (role) => {
    const members = await workspace();
    const ctx = members[role];
    const before = await roles(ctx.company.id);
    const changes: RoleChange[] = [{ membershipId: members.EMPLOYEE.membership.id, role: "ADMIN" }];
    await expect(updateMemberRoles(ctx, changes)).rejects.toMatchObject({ status: 403 });
    fixture.ctx = ctx;
    const data = new FormData();
    data.set(`role:${changes[0].membershipId}`, "ADMIN");
    await expect(updateMemberRolesAction(data)).rejects.toMatchObject({ status: 403 });
    expect(await roles(ctx.company.id)).toEqual(before);
    expect(await roleAudits(ctx.company.id)).toHaveLength(0);
  });

  it("keeps the single-role service protected by the last-administrator rule", async () => {
    const members = await workspace();
    await expect(updateMemberRole(members.ADMIN, members.ADMIN.membership.id, "EMPLOYEE"))
      .rejects.toMatchObject({ code: "LAST_ADMIN", status: 400 });
    expect(await prisma.membership.findUniqueOrThrow({ where: { id: members.ADMIN.membership.id } })).toMatchObject({ role: "ADMIN" });
    expect(await roleAudits(members.ADMIN.company.id)).toHaveLength(0);
  });

  it("submits all role dropdowns in one action and refreshes the localized settings", async () => {
    const members = await workspace();
    fixture.ctx = members.ADMIN;
    vi.mocked(revalidatePath).mockClear();
    const data = new FormData();
    data.set("locale", "ka");
    data.set(`role:${members.ADMIN.membership.id}`, "ADMIN");
    data.set(`role:${members.MANAGER.membership.id}`, "EMPLOYEE");
    data.set(`role:${members.EMPLOYEE.membership.id}`, "MANAGER");

    await updateMemberRolesAction(data);
    expect(await prisma.membership.findUniqueOrThrow({ where: { id: members.MANAGER.membership.id } })).toMatchObject({ role: "EMPLOYEE" });
    expect(await prisma.membership.findUniqueOrThrow({ where: { id: members.EMPLOYEE.membership.id } })).toMatchObject({ role: "MANAGER" });
    expect(await roleAudits(members.ADMIN.company.id)).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith("/ka/settings");
  });
});
