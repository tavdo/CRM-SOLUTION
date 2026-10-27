import { parseWorkspaceDateTime } from "../dates";
import type { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "../db";
import { assertLinkedAccess, recordScope, visibleRelation } from "../scope";
import { AppError } from "../errors";
import { can, canAccessOwnedRecord } from "../permissions";
import type { WorkspaceContext } from "../auth/workspace";

function ownerFilter(ctx: WorkspaceContext): Prisma.TaskWhereInput {
  if (can(ctx.role, "crm.all")) return {};
  return { ownerId: ctx.user.id };
}

export async function listTasks(
  ctx: WorkspaceContext,
  opts: {
    status?: TaskStatus;
    ownerId?: string;
    overdue?: boolean;
    q?: string;
  } = {},
) {
  const where: Prisma.TaskWhereInput = {
    companyId: ctx.company.id,
    ...ownerFilter(ctx),
  };
  if (opts.status) where.status = opts.status;
  if (opts.ownerId && can(ctx.role, "crm.all")) where.ownerId = opts.ownerId;
  if (opts.overdue) {
    where.status = "OPEN";
    where.dueAt = { lt: new Date() };
  }
  if (opts.q?.trim()) {
    where.title = { contains: opts.q.trim() };
  }

  const records = await prisma.task.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, companyId: true, ownerId: true } },
      deal: { select: { id: true, title: true, companyId: true, ownerId: true } },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
  return records.map((record) => ({ ...record, customer: visibleRelation(ctx, record.customer), deal: visibleRelation(ctx, record.deal) }));
}

export async function getTask(ctx: WorkspaceContext, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, ...recordScope(ctx) },
    include: {
      owner: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      customer: true,
      deal: true,
    },
  });
  if (!task) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, task.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return { ...task, customer: visibleRelation(ctx, task.customer), deal: visibleRelation(ctx, task.deal) };
}

export async function createTask(
  ctx: WorkspaceContext,
  input: {
    title: string;
    description?: string;
    dueAt?: string | null;
    ownerId?: string;
    customerId?: string;
    dealId?: string;
  },
) {
  if (!can(ctx.role, "crm.create")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  let ownerId = ctx.user.id;
  if (input.ownerId && input.ownerId !== ctx.user.id) {
    if (!can(ctx.role, "crm.assign")) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }
    const m = await prisma.membership.findUnique({
      where: {
        companyId_userId: { companyId: ctx.company.id, userId: input.ownerId },
      },
    });
    if (!m) throw new AppError("Owner must be a workspace member", "VALIDATION");
    ownerId = input.ownerId;
  }

  if (input.customerId) {
    await assertLinkedAccess(ctx, "customer", input.customerId);
  }
  if (input.dealId) {
    await assertLinkedAccess(ctx, "deal", input.dealId);
  }

  return prisma.task.create({
    data: {
      companyId: ctx.company.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      dueAt: input.dueAt ? parseWorkspaceDateTime(input.dueAt, ctx.company.timezone) : null,
      ownerId,
      creatorId: ctx.user.id,
      customerId: input.customerId || null,
      dealId: input.dealId || null,
    },
  });
}

export async function updateTask(
  ctx: WorkspaceContext,
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    dueAt: string | null;
    ownerId: string;
  }>,
) {
  const task = await getTask(ctx, id);

  let ownerId = task.ownerId;
  if (input.ownerId && input.ownerId !== task.ownerId) {
    if (!can(ctx.role, "crm.assign")) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }
    const m = await prisma.membership.findUnique({
      where: {
        companyId_userId: {
          companyId: ctx.company.id,
          userId: input.ownerId,
        },
      },
    });
    if (!m) throw new AppError("Owner must be a workspace member", "VALIDATION");
    ownerId = input.ownerId;
  }

  return prisma.task.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim() || null,
      dueAt:
        input.dueAt === undefined
          ? undefined
          : input.dueAt
            ? parseWorkspaceDateTime(input.dueAt, ctx.company.timezone)
            : null,
      ownerId,
    },
  });
}

export async function completeTask(ctx: WorkspaceContext, id: string) {
  await getTask(ctx, id);
  return prisma.task.update({
    where: { id },
    data: { status: "DONE", completedAt: new Date() },
  });
}

export async function reopenTask(ctx: WorkspaceContext, id: string) {
  await getTask(ctx, id);
  return prisma.task.update({
    where: { id },
    data: { status: "OPEN", completedAt: null },
  });
}
