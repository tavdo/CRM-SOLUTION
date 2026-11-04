import { AppError } from "../errors";
import type { WorkspaceContext } from "../auth/workspace";
import type { Prisma } from "@prisma/client";
export function requireInbox(ctx: WorkspaceContext, admin = false) {
  if (ctx.role !== "ADMIN" && (admin || ctx.role !== "MANAGER")) throw new AppError("Forbidden", "FORBIDDEN", 403);
}
export function inboxScope(ctx: WorkspaceContext): Prisma.InboxConversationWhereInput {
  requireInbox(ctx);
  return { companyId: ctx.company.id, channel: { companyId: ctx.company.id }, contact: { companyId: ctx.company.id },
    ...(ctx.role === "ADMIN" ? {} : { assignedUserId: ctx.user.id }) };
}
