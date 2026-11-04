import type { WorkspaceContext } from "../auth/workspace";
import { prisma } from "../db";
import { recordScope } from "../scope";
import { sumByCurrency } from "../money";

/** All totals and lists use the same workspace/owner boundary as CRM records. */
export async function getCrmOverview(ctx: WorkspaceContext, now = new Date()) {
  const scope = recordScope(ctx);
  const [deals, stages, leadGroups, openTasks, overdueTasks, upcomingTasks, recentCustomers] = await Promise.all([
    prisma.deal.findMany({ where: { ...scope, archivedAt: null },
      select: { id: true, title: true, amountMinor: true, currency: true, stageId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" } }),
    prisma.pipelineStage.findMany({ where: { companyId: ctx.company.id, archivedAt: null }, orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, isWon: true, isLost: true } }),
    prisma.lead.groupBy({ by: ["source", "status"], where: scope, _count: true }),
    prisma.task.count({ where: { ...scope, status: "OPEN" } }),
    prisma.task.count({ where: { ...scope, status: "OPEN", dueAt: { lt: now } } }),
    prisma.task.findMany({ where: { ...scope, status: "OPEN" },
      select: { id: true, title: true, dueAt: true, owner: { select: { name: true } } },
      // SQLite sorts nulls first unless explicitly placed last.
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 6 }),
    prisma.customer.findMany({ where: { ...scope, archivedAt: null },
      select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);
  const openDeals = deals.filter((deal) => deal.status === "OPEN");
  const won = deals.filter((deal) => deal.status === "WON").length;
  const lost = deals.filter((deal) => deal.status === "LOST").length;
  const sources = [...new Set(leadGroups.map((group) => group.source))].map((source) => ({
    source, count: leadGroups.filter((group) => group.source === source).reduce((total, group) => total + group._count, 0),
  })).sort((a, b) => b.count - a.count);
  return {
    activeDeals: openDeals.length, pipelineValue: sumByCurrency(openDeals), openTasks, overdueTasks,
    newLeads: leadGroups.filter((group) => group.status === "NEW").reduce((total, group) => total + group._count, 0),
    totalLeads: sources.reduce((total, source) => total + source.count, 0), sources,
    won, lost, winRate: won + lost ? Math.round(won / (won + lost) * 100) : null,
    stages: stages.filter((stage) => !stage.isWon && !stage.isLost).map((stage) => ({
      ...stage, count: openDeals.filter((deal) => deal.stageId === stage.id).length,
    })),
    recentDeals: deals.slice(0, 5), upcomingTasks, recentCustomers,
  };
}
