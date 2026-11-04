import Decimal from "decimal.js";
import { prisma } from "../db";
import { can, assertCan } from "../permissions";
import type { WorkspaceContext } from "../auth/workspace";
import { projectAccess, projectScope } from "./access";
import { estimateTotals, tax, COST_CATEGORIES } from "./math";
import { stockQuantity } from "./ledger";

export async function projectFinance(ctx: WorkspaceContext, projectId: string) {
  await projectAccess(ctx, projectId, prisma, true);
  const where = { companyId: ctx.company.id, projectId };
  const [estimates, costs, changes, requests, quotes, orders, partners, subcontracts, acceptances, payments] = await Promise.all([
    prisma.constructionEstimate.findMany({ where, include: { lines: { where: { companyId: ctx.company.id }, orderBy: { sortOrder: "asc" } } }, orderBy: { version: "desc" } }),
    prisma.projectCost.findMany({ where, orderBy: { date: "desc" } }),
    prisma.projectChange.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.materialRequest.findMany({ where, include: { product: { select: { id: true, name: true, unit: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.supplyQuote.findMany({ where, include: { partner: { select: { name: true } }, request: { include: { product: { select: { name: true } } } } } }),
    prisma.purchaseOrder.findMany({ where, include: { partner: { select: { name: true } }, product: { select: { name: true, unit: true } }, movements: { where } }, orderBy: { createdAt: "desc" } }),
    prisma.tradePartner.findMany({ where: { companyId: ctx.company.id }, orderBy: { name: "asc" } }),
    prisma.subcontract.findMany({ where, include: { partner: { select: { name: true } }, progress: { where } }, orderBy: { createdAt: "desc" } }),
    prisma.workAcceptance.findMany({ where, include: { lines: { where }, invoice: { select: { id: true, invoiceNumber: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.projectPayment.findMany({ where, orderBy: { date: "desc" } }),
  ]);
  const approved = estimates.find((e) => e.status === "APPROVED");
  const planned = approved ? estimateTotals(approved.lines, approved.extraMinor, approved.markupBps, approved.vatBps) : null;
  const approvedChanges = changes.filter((c) => c.status === "APPROVED");
  const changeCost = approvedChanges.reduce((sum, c) => sum + c.plannedCostMinor, 0);
  const changeNet = approvedChanges.reduce((sum, c) => sum + c.netRevenueMinor, 0);
  const changeGross = approvedChanges.reduce((sum, c) => sum + c.netRevenueMinor + tax(c.netRevenueMinor, c.vatBps), 0);
  const actual = costs.reduce((sum, c) => sum + c.amountMinor, 0);
  const received = payments.filter((p) => p.direction === "IN").reduce((sum, p) => sum + p.amountMinor, 0);
  const paid = payments.filter((p) => p.direction === "OUT").reduce((sum, p) => sum + p.amountMinor, 0);
  const certified = acceptances.filter((a) => a.status === "CONFIRMED").reduce((sum, a) => sum + a.totalMinor, 0);
  const planCost = planned ? planned.cost + changeCost : null;
  const netContract = planned ? planned.net + changeNet : null;
  const grossContract = planned ? planned.total + changeGross : null;
  const categories = COST_CATEGORIES.map((category) => ({ category,
    planned: planned ? category === "MATERIAL" ? planned.material : category === "LABOR" ? planned.labor : category === "SUBCONTRACT" ? planned.subcontract : category === "EQUIPMENT" ? planned.equipment : planned.other + changeCost : null,
    actual: costs.filter((c) => c.category === category).reduce((sum, c) => sum + c.amountMinor, 0),
  }));
  return { estimates: estimates.map((e) => ({ ...e, totals: estimateTotals(e.lines, e.extraMinor, e.markupBps, e.vatBps) })), costs, changes, requests, quotes, orders, partners, subcontracts, acceptances, payments,
    budget: { planCost, actual, variance: planCost === null ? null : actual - planCost, netContract, grossContract, received, paid, certified,
      forecastProfit: netContract === null || planCost === null ? null : netContract - Math.max(planCost, actual),
      receivable: grossContract === null ? null : grossContract - received,
      certifiedBalance: certified - received, costBalance: actual - paid, categories },
  };
}

export async function projectWorkspace(ctx: WorkspaceContext, projectId: string) {
  const project = await projectAccess(ctx, projectId);
  const where = { companyId: ctx.company.id, projectId };
  const finance = can(ctx.role, "construction.finance");
  const [customer, tasks, reports, documents, requests, movements, products, members] = await Promise.all([
    prisma.customer.findFirst({ where: { id: project.customerId, companyId: ctx.company.id }, select: { id: true, name: true } }),
    prisma.task.findMany({ where, orderBy: { dueAt: "asc" }, include: { owner: { select: { id: true, name: true } } } }),
    prisma.siteReport.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.projectDocument.findMany({ where: { ...where, ...(finance ? {} : { category: { in: ["PHOTO", "DRAWING", "REPORT"] } }) }, select: { id: true, name: true, category: true, mimeType: true, size: true, reportId: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.materialRequest.findMany({ where, include: { product: { select: { id: true, name: true, unit: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.stockMovement.findMany({ where, select: { id: true, productId: true, kind: true, quantity: true, createdAt: true } }),
    prisma.product.findMany({ where: { companyId: ctx.company.id, isActive: true }, select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
    prisma.membership.findMany({ where: { companyId: ctx.company.id }, select: { userId: true, user: { select: { name: true } } } }),
  ]);
  const work = tasks.map((task) => {
    const completedQuantity = Decimal.sum(0, ...reports.filter((r) => r.taskId === task.id && r.kind === "PROGRESS").map((r) => r.completedQuantity));
    const progress = task.plannedQuantity ? Math.min(100, completedQuantity.div(task.plannedQuantity).times(100).toNumber()) : task.status === "DONE" ? 100 : 0;
    return { ...task, completedQuantity: completedQuantity.toFixed(), progress };
  });
  const stock = products.map((p) => ({ ...p, balance: stockQuantity(movements.filter((m) => m.productId === p.id)).toFixed() }));
  const otherProjects = finance ? await prisma.constructionProject.findMany({ where: { AND: [projectScope(ctx), { id: { not: projectId }, status: { not: "ARCHIVED" }, currency: project.currency }] }, select: { id: true, name: true, number: true } }) : [];
  return { project, customer, work, reports, documents, requests, products, stock, members, otherProjects, timezone: ctx.company.timezone,
    progress: work.length ? Math.round(work.reduce((sum, task) => sum + task.progress, 0) / work.length) : 0,
    finance: finance ? await projectFinance(ctx, projectId) : null,
  };
}

export async function listPartners(ctx: WorkspaceContext) {
  assertCan(ctx.role, "construction.finance");
  return prisma.tradePartner.findMany({ where: { companyId: ctx.company.id }, orderBy: { name: "asc" } });
}
