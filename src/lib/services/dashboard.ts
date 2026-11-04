import Decimal from "decimal.js";
import { visibleRelation } from "../scope";
import { prisma } from "../db";
import { can } from "../permissions";
import type { WorkspaceContext } from "../auth/workspace";
import { projectScope } from "../construction/access";
import { estimateTotals, tax } from "../construction/math";

export async function getDashboard(ctx: WorkspaceContext) {
  const companyId = ctx.company.id;
  const finance = can(ctx.role, "construction.finance");
  const [projects, overdueTasks, overdueCount] = await Promise.all([
    prisma.constructionProject.findMany({ where: projectScope(ctx), include: { tasks: { where: { companyId }, select: { id: true, title: true, status: true, plannedQuantity: true } }, reports: { where: { companyId, kind: "PROGRESS" }, select: { taskId: true, completedQuantity: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.task.findMany({ where: { companyId, status: "OPEN", dueAt: { lt: new Date() }, ...(can(ctx.role, "crm.all") ? {} : { ownerId: ctx.user.id }) }, include: { owner: { select: { name: true } }, deal: { select: { id: true, title: true, companyId: true, ownerId: true } } }, orderBy: { dueAt: "asc" }, take: 10 }),
    prisma.task.count({ where: { companyId, status: "OPEN", dueAt: { lt: new Date() }, ...(can(ctx.role, "crm.all") ? {} : { ownerId: ctx.user.id }) } }),
  ]);
  const summaries = projects.map((p) => {
    const progress = p.tasks.length ? Math.round(p.tasks.reduce((sum, task) => {
      const qty = Decimal.sum(0, ...p.reports.filter((r) => r.taskId === task.id).map((r) => r.completedQuantity));
      return sum + (task.plannedQuantity ? Math.min(100, qty.div(task.plannedQuantity).times(100).toNumber()) : task.status === "DONE" ? 100 : 0);
    }, 0) / p.tasks.length) : 0;
    return { id: p.id, name: p.name, number: p.number, status: p.status, endDate: p.endDate, currency: p.currency, progress };
  });
  if (!finance) return { projects: summaries, activeCount: summaries.filter((p) => ["ACTIVE", "PLANNING", "PAUSED"].includes(p.status)).length, overdueTasks: overdueTasks.map((task) => ({ ...task, deal: visibleRelation(ctx, task.deal) })), overdueCount, finance: null };
  const where = { companyId, projectId: { in: projects.filter((p) => p.status !== "ARCHIVED").map((p) => p.id) } };
  const [estimates, costs, changes, payments, pendingPurchases, pendingActs] = await Promise.all([
    prisma.constructionEstimate.findMany({ where: { ...where, status: "APPROVED" }, include: { lines: { where: { companyId } } } }),
    prisma.projectCost.findMany({ where }), prisma.projectChange.findMany({ where: { ...where, status: "APPROVED" } }), prisma.projectPayment.findMany({ where }),
    prisma.materialRequest.count({ where: { ...where, status: "REQUESTED" } }), prisma.workAcceptance.count({ where: { ...where, status: "DRAFT" } }),
  ]);
  const amounts = summaries.filter((p) => p.status !== "ARCHIVED").map((p) => {
    const estimate = estimates.find((e) => e.projectId === p.id);
    const totals = estimate ? estimateTotals(estimate.lines, estimate.extraMinor, estimate.markupBps, estimate.vatBps) : null;
    const variations = changes.filter((c) => c.projectId === p.id);
    const actual = costs.filter((c) => c.projectId === p.id).reduce((sum, c) => sum + c.amountMinor, 0);
    const plan = totals ? totals.cost + variations.reduce((sum, c) => sum + c.plannedCostMinor, 0) : null;
    const contract = totals ? totals.total + variations.reduce((sum, c) => sum + c.netRevenueMinor + tax(c.netRevenueMinor, c.vatBps), 0) : null;
    const received = payments.filter((v) => v.projectId === p.id && v.direction === "IN").reduce((sum, v) => sum + v.amountMinor, 0);
    const paid = payments.filter((v) => v.projectId === p.id && v.direction === "OUT").reduce((sum, v) => sum + v.amountMinor, 0);
    return { ...p, actual, plan, receivable: contract === null ? null : contract - received, payable: actual - paid };
  });
  const currencies = [...new Set(amounts.map((p) => p.currency))].map((currency) => ({ currency, receivable: amounts.filter((p) => p.currency === currency).reduce((sum, p) => sum + (p.receivable ?? 0), 0), payable: amounts.filter((p) => p.currency === currency).reduce((sum, p) => sum + p.payable, 0) }));
  return { projects: summaries, activeCount: summaries.filter((p) => ["ACTIVE", "PLANNING", "PAUSED"].includes(p.status)).length, overdueTasks: overdueTasks.map((task) => ({ ...task, deal: visibleRelation(ctx, task.deal) })), overdueCount, finance: { overBudget: amounts.filter((p) => p.plan !== null && p.actual > p.plan), pendingPurchases, pendingActs, currencies } };
}
