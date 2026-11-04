import type { WorkspaceContext } from "../auth/workspace";
import { getSessionUser } from "../auth/session";
import { prisma } from "../db";
import { inboxScope } from "./access";
import { AppError } from "../errors";

export async function inboxChangeVersion(initial: WorkspaceContext, reauthorize = true) {
  let ctx = initial;
  if (reauthorize) {
    // Keep session expiration, user deletion and role revocation checks, without
    // loading every workspace, company, subscription and plan on each heartbeat.
    const [user, membership] = await Promise.all([
      getSessionUser(),
      prisma.membership.findUnique({ where: { companyId_userId: { companyId: initial.company.id, userId: initial.user.id } }, select: { role: true } }),
    ]);
    if (!user || user.id !== initial.user.id || !membership) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    ctx = { ...initial, user, role: membership.role };
  }
  const result = await prisma.inboxConversation.aggregate({
    where: inboxScope(ctx), _count: { id: true }, _max: { updatedAt: true },
  });
  return `${ctx.role}:${result._count.id}:${result._max.updatedAt?.getTime() || 0}`;
}
