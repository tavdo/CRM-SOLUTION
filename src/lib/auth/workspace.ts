import type { Company, Membership, Role, Subscription, Plan } from "@prisma/client";
import { prisma } from "../db";
import { ensureDbInitialized } from "../db-init";
import { AppError } from "../errors";
import { can, type Capability } from "../permissions";
import {
  getActiveWorkspaceId,
  getSessionUser,
  setActiveWorkspace,
  type SessionUser,
} from "./session";

export type WorkspaceContext = {
  user: SessionUser;
  company: Company;
  membership: Membership;
  role: Role;
  subscription: (Subscription & { plan: Plan }) | null;
};

export async function requireUser(): Promise<SessionUser> {
  await ensureDbInitialized();
  const user = await getSessionUser();
  if (!user) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  return user;
}

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await requireUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      company: {
        include: { subscription: { include: { plan: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    throw new AppError("No workspace", "NO_WORKSPACE", 403);
  }

  const activeId = await getActiveWorkspaceId();
  let membership = memberships.find(
    (m) => m.companyId === activeId || m.company.slug === activeId,
  );

  if (!membership) {
    membership = memberships[0];
    // Note: cookies().set() throws if called inside a Server Component render.
    // Ignore safely during render; Server Actions set the cookie explicitly.
    try {
      await setActiveWorkspace(membership.companyId);
    } catch {
      // Safe no-op during Server Component render
    }
  }

  return {
    user,
    company: membership.company,
    membership,
    role: membership.role,
    subscription: membership.company.subscription,
  };
}

export async function requireCapability(
  capability: Capability,
): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (!can(ctx.role, capability)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return ctx;
}

/** Ensure a record's companyId matches the active workspace. */
export function assertSameTenant(
  recordCompanyId: string,
  workspaceCompanyId: string,
): void {
  if (recordCompanyId !== workspaceCompanyId) {
    throw new AppError("Not found", "NOT_FOUND", 404);
  }
}

export async function listUserWorkspaces(userId: string) {
  await ensureDbInitialized();
  return prisma.membership.findMany({
    where: { userId },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });
}
