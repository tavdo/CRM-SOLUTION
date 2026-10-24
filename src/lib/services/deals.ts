import type { DealStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { enforcePlanLimit } from "../billing/adapter";
import { can, canAccessOwnedRecord } from "../permissions";
import { toMinor } from "../money";
import type { WorkspaceContext } from "../auth/workspace";

function ownerFilter(ctx: WorkspaceContext): Prisma.DealWhereInput {
  if (can(ctx.role, "crm.all")) return {};
  return { ownerId: ctx.user.id };
}

export async function listDeals(
  ctx: WorkspaceContext,
  opts: { status?: DealStatus; archived?: boolean } = {},
) {
  return prisma.deal.findMany({
    where: {
      companyId: ctx.company.id,
      archivedAt: opts.archived ? { not: null } : null,
      status: opts.status,
      ...ownerFilter(ctx),
    },
    include: {
      stage: true,
      owner: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: [{ stage: { sortOrder: "asc" } }, { updatedAt: "desc" }],
  });
}

export async function getDeal(ctx: WorkspaceContext, id: string) {
  const deal = await prisma.deal.findFirst({
    where: { id, companyId: ctx.company.id },
    include: {
      stage: true,
      owner: { select: { id: true, name: true, email: true } },
      customer: true,
      contact: true,
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true } } },
      },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      tasks: {
        orderBy: { dueAt: "asc" },
        include: { owner: { select: { id: true, name: true } } },
      },
    },
  });
  if (!deal) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, deal.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return deal;
}

export async function createDeal(
  ctx: WorkspaceContext,
  input: {
    title: string;
    customerId?: string;
    contactId?: string;
    stageId?: string;
    ownerId?: string;
    amount?: number | string;
    currency?: string;
    expectedCloseAt?: string | null;
  },
) {
  if (!can(ctx.role, "crm.create")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  await enforcePlanLimit(ctx.company.id, "deals");

  if (input.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId: ctx.company.id },
    });
    if (!c) throw new AppError("Customer not found", "NOT_FOUND", 404);
  }
  if (input.contactId) {
    const c = await prisma.contact.findFirst({
      where: { id: input.contactId, companyId: ctx.company.id },
    });
    if (!c) throw new AppError("Contact not found", "NOT_FOUND", 404);
  }

  let stageId = input.stageId;
  if (stageId) {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, companyId: ctx.company.id, archivedAt: null },
    });
    if (!stage) throw new AppError("Stage not found", "NOT_FOUND", 404);
  } else {
    const first = await prisma.pipelineStage.findFirst({
      where: {
        companyId: ctx.company.id,
        archivedAt: null,
        isWon: false,
        isLost: false,
      },
      orderBy: { sortOrder: "asc" },
    });
    if (!first) throw new AppError("No pipeline stages configured", "NO_STAGES");
    stageId = first.id;
  }

  const ownerId =
    can(ctx.role, "crm.assign") && input.ownerId
      ? await assertMember(ctx.company.id, input.ownerId)
      : ctx.user.id;

  const amountMinor = input.amount !== undefined ? toMinor(input.amount) : 0;
  const currency = input.currency ?? ctx.company.currency;

  const deal = await prisma.deal.create({
    data: {
      companyId: ctx.company.id,
      title: input.title.trim(),
      customerId: input.customerId || null,
      contactId: input.contactId || null,
      stageId: stageId!,
      ownerId,
      amountMinor,
      currency,
      expectedCloseAt: input.expectedCloseAt
        ? new Date(input.expectedCloseAt)
        : null,
    },
  });

  await prisma.dealActivity.create({
    data: {
      companyId: ctx.company.id,
      dealId: deal.id,
      actorId: ctx.user.id,
      action: "created",
      detail: JSON.stringify({ title: deal.title }),
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "deal.created",
    entityType: "deal",
    entityId: deal.id,
    detail: { title: deal.title },
  });

  return deal;
}

export async function moveDealStage(
  ctx: WorkspaceContext,
  dealId: string,
  stageId: string,
) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, companyId: ctx.company.id },
  });
  if (!deal) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, deal.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, companyId: ctx.company.id, archivedAt: null },
  });
  if (!stage) throw new AppError("Stage not found", "NOT_FOUND", 404);

  let status: DealStatus = deal.status;
  let closedAt = deal.closedAt;
  let lossReason = deal.lossReason;

  if (stage.isWon) {
    status = "WON";
    closedAt = new Date();
    lossReason = null;
  } else if (stage.isLost) {
    status = "LOST";
    closedAt = new Date();
  } else {
    status = "OPEN";
    closedAt = null;
  }

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: { stageId, status, closedAt, lossReason },
  });

  await prisma.dealActivity.create({
    data: {
      companyId: ctx.company.id,
      dealId,
      actorId: ctx.user.id,
      action: "stage_changed",
      detail: JSON.stringify({
        fromStageId: deal.stageId,
        toStageId: stageId,
        status,
      }),
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "deal.stage_changed",
    entityType: "deal",
    entityId: dealId,
    detail: { stageId, status },
  });

  // Execute Bitrix24-style Pipeline Automation Rules (Robots)
  const rules = await prisma.automationRule.findMany({
    where: {
      companyId: ctx.company.id,
      triggerStageId: stageId,
      isActive: true,
    },
  });
  for (const rule of rules) {
    if (rule.actionType === "CREATE_TASK") {
      await prisma.task.create({
        data: {
          companyId: ctx.company.id,
          title: `[Auto] ${rule.actionDetail}`,
          description: `Triggered automatically by pipeline rule: ${rule.name}`,
          priority: "HIGH",
          boardStage: "TODO",
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          ownerId: deal.ownerId ?? ctx.user.id,
          creatorId: ctx.user.id,
          customerId: deal.customerId,
          dealId: deal.id,
        },
      });
    } else if (rule.actionType === "POST_FEED") {
      await prisma.feedPost.create({
        data: {
          companyId: ctx.company.id,
          authorId: ctx.user.id,
          title: `Deal Update: ${deal.title} → ${stage.name}`,
          body: rule.actionDetail,
          category: stage.isWon ? "WIN" : "UPDATE",
        },
      });
    }
  }

  return updated;
}

export async function closeDeal(
  ctx: WorkspaceContext,
  dealId: string,
  outcome: "WON" | "LOST",
  lossReason?: string,
) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, companyId: ctx.company.id },
  });
  if (!deal) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, deal.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const stage = await prisma.pipelineStage.findFirst({
    where: {
      companyId: ctx.company.id,
      archivedAt: null,
      ...(outcome === "WON" ? { isWon: true } : { isLost: true }),
    },
    orderBy: { sortOrder: "asc" },
  });
  if (!stage) throw new AppError("Won/Lost stage missing", "NO_STAGES");

  if (outcome === "LOST" && !lossReason?.trim()) {
    throw new AppError("Loss reason is required", "VALIDATION");
  }

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      stageId: stage.id,
      status: outcome,
      closedAt: new Date(),
      lossReason: outcome === "LOST" ? lossReason!.trim() : null,
    },
  });

  await prisma.dealActivity.create({
    data: {
      companyId: ctx.company.id,
      dealId,
      actorId: ctx.user.id,
      action: outcome === "WON" ? "won" : "lost",
      detail: JSON.stringify({ lossReason: lossReason ?? null }),
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: `deal.${outcome.toLowerCase()}`,
    entityType: "deal",
    entityId: dealId,
  });

  return updated;
}

export async function updateDeal(
  ctx: WorkspaceContext,
  dealId: string,
  input: Partial<{
    title: string;
    customerId: string | null;
    amount: number | string;
    currency: string;
    expectedCloseAt: string | null;
    ownerId: string | null;
  }>,
) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, companyId: ctx.company.id },
  });
  if (!deal) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, deal.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  if (input.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId: ctx.company.id },
    });
    if (!c) throw new AppError("Customer not found", "NOT_FOUND", 404);
  }

  let ownerId = deal.ownerId;
  if (input.ownerId !== undefined) {
    if (!can(ctx.role, "crm.assign")) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }
    ownerId = input.ownerId
      ? await assertMember(ctx.company.id, input.ownerId)
      : null;
  }

  return prisma.deal.update({
    where: { id: dealId },
    data: {
      title: input.title?.trim(),
      customerId: input.customerId === undefined ? undefined : input.customerId,
      amountMinor:
        input.amount !== undefined ? toMinor(input.amount) : undefined,
      currency: input.currency,
      expectedCloseAt:
        input.expectedCloseAt === undefined
          ? undefined
          : input.expectedCloseAt
            ? new Date(input.expectedCloseAt)
            : null,
      ownerId,
    },
  });
}

export async function listStages(ctx: WorkspaceContext) {
  return prisma.pipelineStage.findMany({
    where: { companyId: ctx.company.id, archivedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

export async function upsertStages(
  ctx: WorkspaceContext,
  stages: { id?: string; name: string; sortOrder: number; isWon?: boolean; isLost?: boolean }[],
) {
  if (!can(ctx.role, "company.pipeline")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  for (const s of stages) {
    if (s.id) {
      const existing = await prisma.pipelineStage.findFirst({
        where: { id: s.id, companyId: ctx.company.id },
      });
      if (!existing) throw new AppError("Stage not found", "NOT_FOUND", 404);
      await prisma.pipelineStage.update({
        where: { id: s.id },
        data: {
          name: s.name.trim(),
          sortOrder: s.sortOrder,
          isWon: !!s.isWon,
          isLost: !!s.isLost,
        },
      });
    } else {
      await prisma.pipelineStage.create({
        data: {
          companyId: ctx.company.id,
          name: s.name.trim(),
          sortOrder: s.sortOrder,
          isWon: !!s.isWon,
          isLost: !!s.isLost,
        },
      });
    }
  }
}

/** Archive a stage after moving its deals to a replacement stage (required). */
export async function deleteStage(
  ctx: WorkspaceContext,
  stageId: string,
  moveToStageId: string,
) {
  if (!can(ctx.role, "company.pipeline")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  if (stageId === moveToStageId) {
    throw new AppError("Choose a different destination stage", "VALIDATION");
  }

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, companyId: ctx.company.id },
  });
  const dest = await prisma.pipelineStage.findFirst({
    where: { id: moveToStageId, companyId: ctx.company.id, archivedAt: null },
  });
  if (!stage || !dest) throw new AppError("Stage not found", "NOT_FOUND", 404);

  await prisma.$transaction([
    prisma.deal.updateMany({
      where: { companyId: ctx.company.id, stageId },
      data: { stageId: moveToStageId },
    }),
    prisma.pipelineStage.update({
      where: { id: stageId },
      data: { archivedAt: new Date() },
    }),
  ]);

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "stage.deleted",
    entityType: "pipeline_stage",
    entityId: stageId,
    detail: { moveToStageId },
  });
}

async function assertMember(companyId: string, userId: string) {
  const m = await prisma.membership.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!m) throw new AppError("Owner must be a workspace member", "VALIDATION");
  return userId;
}
