import { prisma } from "../db";
import { can } from "../permissions";
import { sumByCurrency } from "../money";
import type { WorkspaceContext } from "../auth/workspace";

export async function getDashboard(ctx: WorkspaceContext) {
  const companyId = ctx.company.id;
  const ownerScope = can(ctx.role, "crm.all")
    ? {}
    : { ownerId: ctx.user.id };

  const [
    openDeals,
    wonDeals,
    lostThisMonth,
    openTasks,
    overdueTasks,
    recentCustomers,
    stages,
    allScopedDeals,
  ] = await Promise.all([
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
    prisma.deal.count({
      where: {
        companyId,
        status: "LOST",
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
    prisma.pipelineStage.findMany({
      where: { companyId, archivedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.deal.findMany({
      where: { companyId, archivedAt: null, ...ownerScope },
      select: { status: true, stageId: true, amountMinor: true, currency: true },
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

  const funnel = stages.map((stage) => {
    const inStage = allScopedDeals.filter((d) => d.stageId === stage.id);
    return {
      stageId: stage.id,
      name: stage.name,
      isWon: stage.isWon,
      isLost: stage.isLost,
      count: inStage.length,
      valueByCurrency: sumByCurrency(inStage),
    };
  });

  const totalClosed = wonDeals + lostThisMonth;
  const winRate = totalClosed === 0 ? null : Math.round((wonDeals / totalClosed) * 100);

  return {
    activeDealsCount: openDeals.length,
    pipelineValueByCurrency: sumByCurrency(openDeals),
    wonThisMonth: wonDeals,
    lostThisMonth,
    winRate,
    openTasksCount: openTasks,
    overdueTasks,
    overdueCount: overdueTasks.length,
    upcomingTasks,
    recentCustomers,
    funnel,
    definitions: {
      activeDeals: "OPEN deals that are not archived",
      pipelineValue: "Sum of amountMinor for active deals, grouped by currency (no FX conversion)",
      overdue: "OPEN tasks with dueAt earlier than now (UTC instant)",
      upcoming: "OPEN tasks due within the next 7 days",
      wonThisMonth: "Deals marked WON with closedAt in the current calendar month (UTC)",
      lostThisMonth: "Deals marked LOST with closedAt in the current calendar month (UTC)",
      winRate: "Won / (Won + Lost) this month; null if no closed deals",
      funnel: "Deal counts per pipeline stage (includes won/lost stages)",
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
