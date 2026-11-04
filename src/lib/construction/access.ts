import type { Prisma } from "@prisma/client";
import { can, assertCan } from "../permissions";
import { AppError } from "../errors";
import { prisma } from "../db";
import type { WorkspaceContext } from "../auth/workspace";

export type Db = Prisma.TransactionClient;
export function projectScope(ctx: WorkspaceContext): Prisma.ConstructionProjectWhereInput {
  return { companyId: ctx.company.id, ...(can(ctx.role, "construction.manage") ? {} : {
    OR: [{ managerId: ctx.user.id }, { siteLeadId: ctx.user.id }, { tasks: { some: { companyId: ctx.company.id, ownerId: ctx.user.id } } }],
  }) };
}
export async function projectAccess(ctx: WorkspaceContext, id: string, db: Db = prisma, finance = false) {
  if (finance) assertCan(ctx.role, "construction.finance");
  const project = await db.constructionProject.findFirst({ where: { AND: [{ id }, projectScope(ctx)] } });
  if (!project) throw new AppError("Project not found", "NOT_FOUND", 404);
  return project;
}
export async function member(db: Db, ctx: WorkspaceContext, id: string) {
  if (!await db.membership.findUnique({ where: { companyId_userId: { companyId: ctx.company.id, userId: id } } })) {
    throw new AppError("Member not found", "C_MEMBER", 400);
  }
  return id;
}
export async function lockProject(db: Db, ctx: WorkspaceContext, id: string) {
  await projectAccess(ctx, id, db);
  // Acquire a write lock before stock/progress checks; retries cannot overdraw a balance.
  return db.constructionProject.update({ where: { id }, data: { updatedAt: new Date() } });
}
