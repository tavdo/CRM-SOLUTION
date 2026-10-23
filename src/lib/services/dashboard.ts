import { prisma } from "../db";
import { can } from "../permissions";
import { sumByCurrency } from "../money";
import type { WorkspaceContext } from "../auth/workspace";

export async function getDashboard(ctx: WorkspaceContext) {
  const companyId = ctx.company.id;
  const ownerScope = can(ctx.role, "crm.all")
    ? {}
    : { ownerId: ctx.user.id };

  const [openDeals, wonDeals, openTasks, overdueTasks, recentCustomers] =
    await Promise.all([
      prisma.deal.findMany({
        where: {
          companyId,
          status: "OPEN",
          archivedAt: null,
          ...ownerScope,
        },
        select: { amountMinor: true, currency: true, stageId: true },
      }),
      prisma.deal.count({
        where: {
          companyId,
          status: "WON",
          archivedAt: null,
          closedAt: { gte: startOfMonth() },
          ...ownerScope,
        },
      }),
      prisma.task.count({
        where: { companyId, status: "OPEN", ...ownerScope },
      }),
      prisma.task.findMany({
        where: {
          companyId,
          status: "OPEN",
          dueAt: { lt: new Date() },
          ...ownerScope,
        },
        include: {
          owner: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 10,
      }),
      prisma.customer.findMany({
        where: { companyId, archivedAt: null, ...ownerScope },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

  const upcomingTasks = await prisma.task.findMany({
    where: {
      companyId,
      status: "OPEN",
      dueAt: { gte: new Date(), lte: daysFromNow(7) },
      ...ownerScope,
    },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { dueAt: "asc" },
    take: 10,
  });

  return {
    activeDealsCount: openDeals.length,
    pipelineValueByCurrency: sumByCurrency(openDeals),
    wonThisMonth: wonDeals,
    openTasksCount: openTasks,
    overdueTasks,
    upcomingTasks,
    recentCustomers,
    definitions: {
      activeDeals: "OPEN deals that are not archived",
      pipelineValue: "Sum of amountMinor for active deals, grouped by currency (no FX conversion)",
      overdue: "OPEN tasks with dueAt earlier than now (UTC instant)",
      upcoming: "OPEN tasks due within the next 7 days",
      wonThisMonth: "Deals marked WON with closedAt in the current calendar month (UTC)",
    },
  };
}

function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}
