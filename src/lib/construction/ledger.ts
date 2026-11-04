import Decimal from "decimal.js";
import { z } from "zod";
import type { WorkspaceContext } from "../auth/workspace";
import { parseDateOnly } from "../dates";
import { AppError } from "../errors";
import { type Db, projectAccess, lockProject } from "./access";
import { change, parse, text, id, key, qty, money, percent, replay, missing, conflict } from "./core";
import { integer, lineAmount, tax, invalid } from "./math";

async function product(db: Db, ctx: WorkspaceContext, productId: string) {
  const item = await db.product.findFirst({ where: { id: productId, companyId: ctx.company.id, isActive: true } });
  if (!item) missing();
  return item;
}
async function partner(db: Db, ctx: WorkspaceContext, partnerId: string, kind: "SUPPLIER" | "SUBCONTRACTOR") {
  const item = await db.tradePartner.findFirst({ where: { id: partnerId, companyId: ctx.company.id, kind: { in: [kind, "BOTH"] } } });
  if (!item) missing();
  return item;
}
export async function requestMaterial(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ productId: id, quantity: qty, operationKey: key }), raw);
  return change(ctx, projectId, false, "material.requested", async (db) => {
    await product(db, ctx, data.productId);
    const existing = replay(await db.materialRequest.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { productId: data.productId, quantity: data.quantity });
    return existing ?? db.materialRequest.create({ data: { ...data, companyId: ctx.company.id, projectId, requestedById: ctx.user.id } });
  });
}
export async function addSupplyQuote(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ requestId: id, partnerId: id, unitMinor: money, notes: z.string().max(2000).optional() }), raw);
  return change(ctx, projectId, true, "supplier_quote.recorded", async (db) => {
    if (!await db.materialRequest.findFirst({ where: { id: data.requestId, companyId: ctx.company.id, projectId, status: "REQUESTED" } })) missing();
    await partner(db, ctx, data.partnerId, "SUPPLIER");
    return db.supplyQuote.create({ data: { ...data, companyId: ctx.company.id, projectId } });
  });
}
export async function orderQuote(ctx: WorkspaceContext, projectId: string, quoteId: string) {
  return change(ctx, projectId, true, "purchase.ordered", async (db) => {
    const quote = await db.supplyQuote.findFirst({ where: { id: quoteId, companyId: ctx.company.id, projectId }, include: { request: true } });
    if (!quote || quote.request.companyId !== ctx.company.id || quote.request.projectId !== projectId) missing();
    const existing = await db.purchaseOrder.findUnique({ where: { requestId: quote.requestId } });
    if (existing) { if (existing.partnerId !== quote.partnerId || existing.unitMinor !== quote.unitMinor) conflict(); return existing; }
    await partner(db, ctx, quote.partnerId, "SUPPLIER");
    await product(db, ctx, quote.request.productId);
    await db.materialRequest.update({ where: { id: quote.requestId }, data: { status: "ORDERED" } });
    return db.purchaseOrder.create({ data: { companyId: ctx.company.id, projectId, requestId: quote.requestId, partnerId: quote.partnerId, productId: quote.request.productId, quantity: quote.request.quantity, unitMinor: quote.unitMinor, totalMinor: lineAmount(quote.request.quantity, quote.unitMinor) } });
  });
}
export function stockQuantity(movements: { kind: string; quantity: string }[]): Decimal {
  return movements.reduce((sum, row) => ["RECEIVE", "RETURN", "TRANSFER_IN"].includes(row.kind) ? sum.plus(row.quantity) : sum.minus(row.quantity), new Decimal(0));
}
export async function receiveOrder(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ orderId: id, quantity: qty, operationKey: key }), raw);
  return change(ctx, projectId, true, "purchase.received", async (db) => {
    const order = await db.purchaseOrder.findFirst({ where: { id: data.orderId, companyId: ctx.company.id, projectId } });
    if (!order || !["ORDERED", "RECEIVED"].includes(order.status)) missing();
    const existing = replay(await db.stockMovement.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { purchaseOrderId: order.id, quantity: data.quantity, kind: "RECEIVE" });
    if (existing) return existing;
    const receipts = await db.stockMovement.findMany({ where: { companyId: ctx.company.id, projectId, purchaseOrderId: order.id, kind: "RECEIVE" } });
    const oldQty = Decimal.sum(0, ...receipts.map((r) => r.quantity));
    const newQty = oldQty.plus(data.quantity);
    if (newQty.gt(order.quantity)) throw new AppError("Receipt exceeds order", "C_QUANTITY", 400);
    // Cumulative rounding ensures split receipts add up to the exact order amount.
    const cost = integer(newQty.times(order.unitMinor)) - integer(oldQty.times(order.unitMinor));
    const movement = await db.stockMovement.create({ data: { companyId: ctx.company.id, projectId, productId: order.productId, purchaseOrderId: order.id, kind: "RECEIVE", quantity: data.quantity, valueMinor: cost, operationKey: data.operationKey, createdById: ctx.user.id } });
    await db.projectCost.create({ data: { companyId: ctx.company.id, projectId, category: "MATERIAL", description: order.id, amountMinor: cost, date: new Date(), operationKey: `receipt:${movement.id}`, createdById: ctx.user.id } });
    if (newQty.eq(order.quantity)) {
      await db.purchaseOrder.update({ where: { id: order.id }, data: { status: "RECEIVED" } });
      await db.materialRequest.update({ where: { id: order.requestId }, data: { status: "RECEIVED" } });
    }
    return movement;
  });
}
export async function moveStock(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ productId: id, quantity: qty, kind: z.enum(["USE", "RETURN", "TRANSFER"]), otherProjectId: z.string().optional(), operationKey: key }), raw);
  return change(ctx, projectId, true, "stock.moved", async (db) => {
    await product(db, ctx, data.productId);
    const existing = replay(await db.stockMovement.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { productId: data.productId, quantity: data.quantity, kind: data.kind === "TRANSFER" ? "TRANSFER_OUT" : data.kind, otherProjectId: data.kind === "TRANSFER" ? data.otherProjectId : null });
    if (existing) return existing;
    const rows = await db.stockMovement.findMany({ where: { companyId: ctx.company.id, projectId, productId: data.productId } });
    let valueMinor: number;
    if (data.kind === "RETURN") {
      const used = Decimal.sum(0, ...rows.filter((r) => r.kind === "USE").map((r) => r.quantity));
      const returned = Decimal.sum(0, ...rows.filter((r) => r.kind === "RETURN").map((r) => r.quantity));
      if (returned.plus(data.quantity).gt(used)) throw new AppError("Return exceeds used quantity", "C_QUANTITY", 400);
      const issuedValue = rows.filter((r) => r.kind === "USE").reduce((sum, r) => sum + r.valueMinor, 0) - rows.filter((r) => r.kind === "RETURN").reduce((sum, r) => sum + r.valueMinor, 0);
      valueMinor = integer(new Decimal(issuedValue).times(data.quantity).div(used.minus(returned)));
    } else {
      const available = stockQuantity(rows);
      if (available.lt(data.quantity)) throw new AppError("Insufficient stock", "C_STOCK", 400);
      const availableValue = rows.reduce((sum, r) => sum + (["RECEIVE", "RETURN", "TRANSFER_IN"].includes(r.kind) ? r.valueMinor : -r.valueMinor), 0);
      valueMinor = integer(new Decimal(availableValue).times(data.quantity).div(available));
    }
    if (data.kind === "TRANSFER") {
      if (!data.otherProjectId || data.otherProjectId === projectId) invalid();
      const destination = await lockProject(db, ctx, data.otherProjectId);
      const source = await projectAccess(ctx, projectId, db);
      if (destination.currency !== source.currency) throw new AppError("Stock transfer requires matching project currencies", "C_CURRENCY", 400);
    }
    const movement = await db.stockMovement.create({ data: { companyId: ctx.company.id, projectId, productId: data.productId, kind: data.kind === "TRANSFER" ? "TRANSFER_OUT" : data.kind, quantity: data.quantity, valueMinor, otherProjectId: data.kind === "TRANSFER" ? data.otherProjectId : null, operationKey: data.operationKey, createdById: ctx.user.id } });
    if (data.kind === "TRANSFER") {
      await db.stockMovement.create({ data: { companyId: ctx.company.id, projectId: data.otherProjectId!, productId: data.productId, kind: "TRANSFER_IN", quantity: data.quantity, valueMinor, otherProjectId: projectId, operationKey: `${data.operationKey}:in`, createdById: ctx.user.id } });
      for (const [target, amount] of [[projectId, -valueMinor], [data.otherProjectId!, valueMinor]] as const) await db.projectCost.create({ data: { companyId: ctx.company.id, projectId: target, category: "MATERIAL", description: `Transfer ${movement.id}`, amountMinor: amount, date: new Date(), operationKey: `transfer:${movement.id}:${target}`, createdById: ctx.user.id } });
      await import("./core").then(({ audit }) => audit(db, ctx, "stock.transferred_in", data.otherProjectId!));
    }
    return movement;
  });
}
export async function createSubcontract(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ partnerId: id, title: text, unit: text.max(30), quantity: qty, unitMinor: money }), raw);
  return change(ctx, projectId, true, "subcontract.created", async (db) => {
    await partner(db, ctx, data.partnerId, "SUBCONTRACTOR");
    return db.subcontract.create({ data: { ...data, companyId: ctx.company.id, projectId, totalMinor: lineAmount(data.quantity, data.unitMinor) } });
  });
}
export async function confirmSubcontractProgress(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ subcontractId: id, quantity: qty, date: text, operationKey: key }), raw);
  return change(ctx, projectId, true, "subcontract.work_confirmed", async (db) => {
    const agreement = await db.subcontract.findFirst({ where: { id: data.subcontractId, companyId: ctx.company.id, projectId }, include: { progress: { where: { companyId: ctx.company.id, projectId } } } });
    if (!agreement) missing();
    const existing = replay(await db.subcontractProgress.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { subcontractId: data.subcontractId, quantity: data.quantity });
    if (existing) return existing;
    const oldQty = Decimal.sum(0, ...agreement.progress.map((p) => p.quantity));
    const newQty = oldQty.plus(data.quantity);
    if (newQty.gt(agreement.quantity)) throw new AppError("Quantity exceeds agreement", "C_QUANTITY", 400);
    const result = await db.subcontractProgress.create({ data: { ...data, companyId: ctx.company.id, projectId, date: parseDateOnly(data.date), confirmedById: ctx.user.id } });
    await db.projectCost.create({ data: { companyId: ctx.company.id, projectId, category: "SUBCONTRACT", description: agreement.title, amountMinor: integer(newQty.times(agreement.unitMinor)) - integer(oldQty.times(agreement.unitMinor)), date: parseDateOnly(data.date), operationKey: `subcontract:${result.id}`, createdById: ctx.user.id } });
    if (newQty.eq(agreement.quantity)) await db.subcontract.update({ where: { id: agreement.id }, data: { status: "COMPLETED" } });
    return result;
  });
}
const acceptanceLine = z.object({ description: text, unit: text.max(30), quantity: qty, unitMinor: money });
export async function createAcceptance(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ number: text.max(60), vatBps: percent, operationKey: key, lines: z.array(acceptanceLine).min(1).max(200) }), raw);
  return change(ctx, projectId, true, "acceptance.created", async (db) => {
    const lines = data.lines.map((line) => ({ ...line, companyId: ctx.company.id, projectId, totalMinor: lineAmount(line.quantity, line.unitMinor) }));
    const netMinor = integer(Decimal.sum(0, ...lines.map((l) => l.totalMinor)));
    const vatMinor = tax(netMinor, data.vatBps);
    const existing = replay(await db.workAcceptance.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { number: data.number, vatBps: data.vatBps, netMinor });
    if (existing) {
      const oldLines = await db.acceptanceLine.findMany({ where: { acceptanceId: existing.id, companyId: ctx.company.id, projectId } });
      const fingerprint = (items: typeof data.lines) => JSON.stringify(items.map(({ description, unit, quantity, unitMinor }) => ({ description, unit, quantity, unitMinor })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      if (fingerprint(oldLines) !== fingerprint(data.lines)) conflict();
      return existing;
    }
    return db.workAcceptance.create({ data: { companyId: ctx.company.id, projectId, number: data.number, vatBps: data.vatBps, operationKey: data.operationKey, netMinor, vatMinor, totalMinor: integer(new Decimal(netMinor).plus(vatMinor)), lines: { create: lines } } });
  });
}
export async function confirmAcceptance(ctx: WorkspaceContext, projectId: string, acceptanceId: string) {
  return change(ctx, projectId, true, "acceptance.confirmed_manually", async (db) => {
    const acceptance = await db.workAcceptance.findFirst({ where: { id: acceptanceId, companyId: ctx.company.id, projectId } });
    if (!acceptance) missing();
    if (acceptance.status === "CONFIRMED") return acceptance;
    return db.workAcceptance.update({ where: { id: acceptanceId }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: ctx.user.id } });
  });
}
export async function invoiceAcceptance(ctx: WorkspaceContext, projectId: string, acceptanceId: string) {
  return change(ctx, projectId, true, "acceptance.invoiced", async (db) => {
    const project = await projectAccess(ctx, projectId, db, true);
    const act = await db.workAcceptance.findFirst({ where: { id: acceptanceId, companyId: ctx.company.id, projectId, status: "CONFIRMED" } });
    if (!act) missing();
    const existing = await db.invoice.findUnique({ where: { acceptanceId } });
    if (existing) { if (existing.companyId !== ctx.company.id || existing.projectId !== projectId) conflict(); return existing; }
    // The detailed decimal quantities remain on the act. The legacy invoice stores one summary line.
    return db.invoice.create({ data: { companyId: ctx.company.id, projectId, acceptanceId, customerId: project.customerId, dealId: project.dealId, invoiceNumber: `ACT-${act.id}`, status: "DRAFT", subtotalMinor: act.netMinor, vatRate: Math.trunc(act.vatBps / 100), vatRateBps: act.vatBps, vatMinor: act.vatMinor, totalMinor: act.totalMinor, currency: project.currency, includeVat: act.vatBps > 0, items: { create: { description: act.number, quantity: 1, unit: "ACT", unitMinor: act.netMinor, totalMinor: act.netMinor } } } });
  });
}
export async function recordPayment(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ direction: z.enum(["IN", "OUT"]), kind: z.enum(["ADVANCE", "STAGE", "FINAL", "OTHER"]), amountMinor: money, description: text, date: text, subcontractId: z.string().optional(), operationKey: key }), raw);
  if (!data.amountMinor) invalid();
  return change(ctx, projectId, true, "payment.recorded_manually", async (db) => {
    const subcontractId = data.subcontractId || null;
    if (subcontractId && (data.direction !== "OUT" || !await db.subcontract.findFirst({ where: { id: subcontractId, companyId: ctx.company.id, projectId } }))) missing();
    const existing = replay(await db.projectPayment.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { amountMinor: data.amountMinor, direction: data.direction, kind: data.kind, subcontractId, description: data.description, date: parseDateOnly(data.date) });
    return existing ?? db.projectPayment.create({ data: { ...data, subcontractId, companyId: ctx.company.id, projectId, date: parseDateOnly(data.date), recordedById: ctx.user.id } });
  });
}
