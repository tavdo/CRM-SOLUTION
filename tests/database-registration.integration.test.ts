import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, rmSync } from "node:fs";

const fixture = vi.hoisted(() => ({
  file: `${process.cwd().replaceAll("\\", "/")}/prisma/registration-${process.pid}-${Date.now()}.db`,
  cookies: new Map<string, string>(),
}));

vi.mock("../src/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  // Raw migrations use connection-local SQLite pragmas while rebuilding tables.
  return { prisma: new PrismaClient({ datasourceUrl: `file:${fixture.file}?connection_limit=1` }) };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "127.0.0.1" }),
  cookies: async () => ({
    get: (name: string) => fixture.cookies.has(name) ? { value: fixture.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => fixture.cookies.set(name, value),
    delete: (name: string) => fixture.cookies.delete(name),
  }),
}));
vi.mock("../src/lib/db-init", () => ({ ensureDbInitialized: vi.fn() }));

import { prisma } from "../src/lib/db";
import { signInAction, signUpAction } from "../src/app/actions/auth";
import { getSessionUser, destroySession } from "../src/lib/auth/session";
import { requireWorkspace } from "../src/lib/auth/workspace";
import { registerCompany, requestPasswordReset, resendVerificationEmail } from "../src/lib/services/onboarding";
import { inviteMember } from "../src/lib/services/members";
import { getCustomer } from "../src/lib/services/customers";
import { verifyPassword } from "../src/lib/crypto";

const password = "Isolated-Registration-Test123!";

beforeAll(async () => {
  for (const name of readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort()) {
    const statements = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").split(";");
    for (const statement of statements.map(value => value.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
});

beforeEach(() => {
  fixture.cookies.clear();
  vi.stubEnv("DEPLOYMENT_MODE", "preview");
  vi.stubEnv("REGISTRATION_MODE", "database");
  vi.stubEnv("PREVIEW_EMAILS", "old-owner@example.test");
  vi.stubEnv("SESSION_SECRET", "isolated-test-session-secret-at-least-32-characters");
  vi.stubEnv("TRUSTED_IP_HEADER", "x-real-ip");
  vi.stubEnv("EMAIL_TRANSPORT", "smtp");
  vi.stubEnv("SMTP_HOST", "");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await prisma.$disconnect();
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(fixture.file + suffix, { force: true });
});

describe("database registration through the normal authentication flow", () => {
  it("rejects reserved demo identities before persisting an unusable account", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(registerCompany({ companyName: "Reserved", adminName: "Reserved", email: "admin@crm.local", password, locale: "en" }))
      .rejects.toMatchObject({ code: "RESERVED_EMAIL" });
    expect(await prisma.user.findUnique({ where: { email: "admin@crm.local" } })).toBeNull();
  });
  it("creates a hashed, unverified account, opens its workspace, and permits later password sign-in", async () => {
    const form = new FormData();
    form.set("companyName", "სატესტო გუნდი");
    form.set("adminName", "ტესტი");
    form.set("email", "NEW-PERSON@example.test");
    form.set("password", password);
    form.set("locale", "ka");
    await expect(signUpAction(null, form)).rejects.toMatchObject({
      digest: expect.stringContaining("/ka/onboarding"),
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "new-person@example.test" } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash).not.toBe(password);
    expect(await verifyPassword(password, user.passwordHash)).toBe(true);
    expect(await prisma.emailVerifyToken.count({ where: { userId: user.id } })).toBe(0);
    expect(await getSessionUser()).toMatchObject({ id: user.id, emailVerifiedAt: null });
    const ctx = await requireWorkspace();
    expect(ctx.company.name).toBe("სატესტო გუნდი");
    expect(ctx.membership.role).toBe("ADMIN");
    expect(await prisma.pipelineStage.count({ where: { companyId: ctx.company.id } })).toBe(6);
    expect(ctx.subscription?.status).toBe("TRIALING");

    await destroySession();
    expect(await getSessionUser()).toBeNull();
    await expect(signInAction(null, form)).rejects.toMatchObject({ digest: expect.stringContaining("/ka/dashboard") });
    expect((await requireWorkspace()).company.id).toBe(ctx.company.id);
    await expect(signUpAction(null, form)).resolves.toEqual({ error: "Email already registered" });
  });

  it("keeps new registrations isolated from every existing workspace", async () => {
    const first = await registerCompany({ companyName: "First", adminName: "First", email: "first@example.test", password, locale: "en" });
    const customer = await prisma.customer.create({ data: { name: "Private first customer", companyId: first.companyId } });
    const second = await registerCompany({ companyName: "Second", adminName: "Second", email: "second@example.test", password, locale: "en" });
    const ctx = await requireWorkspace();
    expect(ctx.company.id).toBe(second.companyId);
    expect(ctx.company.id).not.toBe(first.companyId);
    await expect(getCustomer(ctx, customer.id)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.membership.count({ where: { userId: second.userId } })).toBe(1);
  });

  it("rejects email-dependent actions before creating undeliverable tokens or invitations", async () => {
    const account = await registerCompany({ companyName: "No mail", adminName: "No mail", email: "no-mail@example.test", password, locale: "en" });
    const ctx = await requireWorkspace();
    await expect(requestPasswordReset("no-mail@example.test", "en")).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
    await expect(resendVerificationEmail(account.userId, "en")).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
    await expect(inviteMember(ctx, { email: "invitee@example.test", role: "EMPLOYEE" })).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
    expect(await prisma.passwordResetToken.count()).toBe(0);
    expect(await prisma.emailVerifyToken.count()).toBe(0);
    expect(await prisma.invitation.count()).toBe(0);
  });
});
