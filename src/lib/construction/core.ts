import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../errors";
import { assertCan, can } from "../permissions";
import { parseDateOnly, parseWorkspaceDateTime } from "../dates";
import { normalizePhone } from "../normalization";
import type { WorkspaceContext } from "../auth/workspace";
import { type Db, projectAccess, projectScope, member, lockProject } from "./access";
import { minor, quantity, basisPoints, estimateTotals, invalid, COST_CATEGORIES } from "./math";

export const text = z.string().trim().min(1).max(500);
export const id = z.string().min(1).max(100);
export const key = z.string().uuid();
export const qty = z.string().transform((v) => quantity(v));
export const money = z.string().transform(minor);
export const percent = z.string().transform(basisPoints);
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const normalize = (v: unknown): unknown => typeof v === "string" ? v.normalize("NFC") : Array.isArray(v) ? v.map(normalize) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)])) : v;
  const parsed = schema.safeParse(normalize(value));
  if (!parsed.success) invalid();
  return parsed.data;
}
export function missing(): never { throw new AppError("Record not found", "NOT_FOUND", 404); }
export function conflict(): never { throw new AppError("Conflicting operation", "C_CONFLICT", 409); }
export function replay<T extends { projectId: string }>(existing: T | null, projectId: string, fields: Record<string, unknown> = {}): T | null {
  if (!existing) return null;
  if (existing.projectId !== projectId || Object.entries(fields).some(([k, v]) => JSON.stringify((existing as Record<string, unknown>)[k]) !== JSON.stringify(v))) conflict();
  return existing;
}
export async function audit(db: Db, ctx: WorkspaceContext, action: string, entityId: string) {
  await db.auditEvent.create({ data: { companyId: ctx.company.id, actorId: ctx.user.id, action: `construction.${action}`, entityType: "construction_project", entityId } });
}
export async function change<T>(ctx: WorkspaceContext, projectId: string, finance: boolean, action: string, fn: (db: Db) => Promise<T>) {
  if (finance) assertCan(ctx.role, "construction.finance");
  return prisma.$transaction(async (db) => {
    await lockProject(db, ctx, projectId);
    const result = await fn(db);
    await audit(db, ctx, action, projectId);
    return result;
  }, { timeout: 15000 });
}

export async function listProjects(ctx: WorkspaceContext) {
  return prisma.constructionProject.findMany({ where: projectScope(ctx), include: { customer: { select: { id: true, name: true } }, _count: { select: { tasks: true } } }, orderBy: { updatedAt: "desc" } });
}
export async function createProject(ctx: WorkspaceContext, raw: unknown) {
  assertCan(ctx.role, "construction.manage");
  const data = parse(z.object({ name: text, number: text.max(60), customerId: id, address: text, workType: text,
    description: z.string().trim().max(10000).optional(), managerId: id, siteLeadId: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(), contractNumber: z.string().trim().max(100).optional() }), raw);
  return prisma.$transaction(async (db) => {
    if (!await db.customer.findFirst({ where: { id: data.customerId, companyId: ctx.company.id, archivedAt: null } })) missing();
    await member(db, ctx, data.managerId);
    if (data.siteLeadId) await member(db, ctx, data.siteLeadId);
    const startDate = data.startDate ? parseDateOnly(data.startDate) : null;
    const endDate = data.endDate ? parseDateOnly(data.endDate) : null;
    if (startDate && endDate && startDate > endDate) invalid();
    const existing = await db.constructionProject.findUnique({ where: { companyId_number: { companyId: ctx.company.id, number: data.number } } });
    if (existing) { if (existing.name !== data.name || existing.customerId !== data.customerId) conflict(); return existing; }
    const project = await db.constructionProject.create({ data: { ...data, siteLeadId: data.siteLeadId || null, startDate, endDate, companyId: ctx.company.id, currency: ctx.company.currency } });
    await audit(db, ctx, "project.created", project.id);
    return project;
  });
}
export async function projectFromDeal(ctx: WorkspaceContext, dealId: string) {
  assertCan(ctx.role, "construction.manage");
  return prisma.$transaction(async (db) => {
    const existing = await db.constructionProject.findFirst({ where: { companyId: ctx.company.id, dealId } });
    if (existing) return existing;
    const deal = await db.deal.findFirst({ where: { id: dealId, companyId: ctx.company.id, status: "WON", archivedAt: null }, include: { customer: true } });
    if (!deal || !deal.customer || deal.customer.companyId !== ctx.company.id || deal.customer.archivedAt) missing();
    const managerId = deal.ownerId ? await member(db, ctx, deal.ownerId) : ctx.user.id;
    const project = await db.constructionProject.create({ data: { companyId: ctx.company.id, number: `OBJ-${randomUUID().slice(0, 8).toUpperCase()}`, name: deal.title, customerId: deal.customer.id, dealId, address: deal.customer.address || "—", workType: "GENERAL", stage: "CONTRACT", managerId, currency: deal.currency } });
    await audit(db, ctx, "deal.converted", project.id);
    return project;
  });
}
export async function updateProject(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  assertCan(ctx.role, "construction.manage");
  const data = parse(z.object({ name: text, address: text, workType: text, status: z.enum(["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]), stage: z.enum(["SITE_VISIT", "ESTIMATE", "OFFER", "CONTRACT", "EXECUTION", "ACCEPTANCE", "PAYMENT", "HANDOVER"]), managerId: id, siteLeadId: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(), description: z.string().trim().max(10000), contractNumber: z.string().trim().max(100) }), raw);
  return change(ctx, projectId, false, "project.updated", async (db) => {
    await member(db, ctx, data.managerId);
    if (data.siteLeadId) await member(db, ctx, data.siteLeadId);
    const startDate = data.startDate ? parseDateOnly(data.startDate) : null;
    const endDate = data.endDate ? parseDateOnly(data.endDate) : null;
    if (startDate && endDate && startDate > endDate) invalid();
    return db.constructionProject.update({ where: { id: projectId }, data: { ...data, siteLeadId: data.siteLeadId || null, startDate, endDate } });
  });
}

export async function createEstimate(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ operationKey: key, markupBps: percent, vatBps: percent, extraMinor: money, revisionId: z.string().optional() }), raw);
  return change(ctx, projectId, true, "estimate.created", async (db) => {
    const existing = replay(await db.constructionEstimate.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId);
    if (existing) return existing;
    const previous = data.revisionId ? await db.constructionEstimate.findFirst({ where: { id: data.revisionId, companyId: ctx.company.id, projectId }, include: { lines: true } }) : null;
    if (data.revisionId && !previous) missing();
    const max = await db.constructionEstimate.aggregate({ where: { companyId: ctx.company.id, projectId }, _max: { version: true } });
    return db.constructionEstimate.create({ data: { companyId: ctx.company.id, projectId, version: (max._max.version ?? 0) + 1, operationKey: data.operationKey, createdById: ctx.user.id,
      markupBps: previous?.markupBps ?? data.markupBps, vatBps: previous?.vatBps ?? data.vatBps, extraMinor: previous?.extraMinor ?? data.extraMinor,
      lines: previous ? { create: previous.lines.map(({ description, unit, quantity, materialUnitMinor, laborUnitMinor, otherUnitMinor, subcontractUnitMinor, equipmentUnitMinor, sortOrder }) => ({ companyId: ctx.company.id, description, unit, quantity, materialUnitMinor, laborUnitMinor, otherUnitMinor, subcontractUnitMinor, equipmentUnitMinor, sortOrder })) } : undefined,
    } });
  });
}
export async function addEstimateLine(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ estimateId: id, description: text, unit: text.max(30), quantity: qty, materialUnitMinor: money, laborUnitMinor: money, otherUnitMinor: money, subcontractUnitMinor: money.optional().transform((v) => v ?? 0), equipmentUnitMinor: money.optional().transform((v) => v ?? 0) }), raw);
  return change(ctx, projectId, true, "estimate.line_added", async (db) => {
    const estimate = await db.constructionEstimate.findFirst({ where: { id: data.estimateId, projectId, companyId: ctx.company.id }, include: { lines: true } });
    if (!estimate) missing();
    if (estimate.status !== "DRAFT") conflict();
    estimateTotals([...estimate.lines, data], estimate.extraMinor, estimate.markupBps, estimate.vatBps);
    return db.estimateLine.create({ data: { ...data, companyId: ctx.company.id, sortOrder: estimate.lines.length } });
  });
}
export async function approveEstimate(ctx: WorkspaceContext, projectId: string, estimateId: string) {
  return change(ctx, projectId, true, "estimate.approved", async (db) => {
    const estimate = await db.constructionEstimate.findFirst({ where: { id: estimateId, projectId, companyId: ctx.company.id }, include: { lines: true } });
    if (!estimate) missing();
    if (estimate.status === "APPROVED") return estimate;
    if (estimate.status !== "DRAFT" || !estimate.lines.length) conflict();
    estimateTotals(estimate.lines, estimate.extraMinor, estimate.markupBps, estimate.vatBps);
    await db.constructionEstimate.updateMany({ where: { projectId, companyId: ctx.company.id, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
    return db.constructionEstimate.update({ where: { id: estimateId }, data: { status: "APPROVED", approvedAt: new Date() } });
  });
}
export async function editEstimate(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ estimateId: id, markupBps: percent, vatBps: percent, extraMinor: money }), raw);
  return change(ctx, projectId, true, "estimate.updated", async (db) => {
    const estimate = await db.constructionEstimate.findFirst({ where: { id: data.estimateId, companyId: ctx.company.id, projectId }, include: { lines: true } });
    if (!estimate) missing();
    if (estimate.status !== "DRAFT") conflict();
    estimateTotals(estimate.lines, data.extraMinor, data.markupBps, data.vatBps);
    const { estimateId, ...values } = data;
    return db.constructionEstimate.update({ where: { id: estimateId }, data: values });
  });
}
export async function removeEstimateLine(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ estimateId: id, lineId: id }), raw);
  return change(ctx, projectId, true, "estimate.line_removed", async (db) => {
    const estimate = await db.constructionEstimate.findFirst({ where: { id: data.estimateId, companyId: ctx.company.id, projectId } });
    if (!estimate) missing();
    if (estimate.status !== "DRAFT") conflict();
    return db.estimateLine.deleteMany({ where: { id: data.lineId, estimateId: estimate.id, companyId: ctx.company.id } });
  });
}
export async function recordCost(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ category: z.enum(COST_CATEGORIES), description: text, amountMinor: money, date: text, operationKey: key }), raw);
  if (!data.amountMinor) invalid();
  return change(ctx, projectId, true, "cost.recorded", async (db) => {
    const existing = replay(await db.projectCost.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { amountMinor: data.amountMinor, category: data.category });
    return existing ?? db.projectCost.create({ data: { ...data, date: parseDateOnly(data.date), companyId: ctx.company.id, projectId, createdById: ctx.user.id } });
  });
}
export async function addChange(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ title: text, plannedCostMinor: money, netRevenueMinor: money, vatBps: percent }), raw);
  return change(ctx, projectId, true, "change.requested", (db) => db.projectChange.create({ data: { ...data, companyId: ctx.company.id, projectId } }));
}
export async function approveChange(ctx: WorkspaceContext, projectId: string, changeId: string) {
  return change(ctx, projectId, true, "change.approved", async (db) => {
    const item = await db.projectChange.findFirst({ where: { id: changeId, projectId, companyId: ctx.company.id } });
    if (!item) missing();
    return db.projectChange.update({ where: { id: changeId }, data: { status: "APPROVED", approvedAt: item.approvedAt ?? new Date() } });
  });
}
export async function createWork(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  assertCan(ctx.role, "construction.manage");
  const data = parse(z.object({ title: text, phase: z.string().trim().max(100).optional(), ownerId: id, plannedQuantity: qty, workUnit: text.max(30), dueAt: z.string().optional(), constructionKey: key }), raw);
  return change(ctx, projectId, false, "work.created", async (db) => {
    const project = await projectAccess(ctx, projectId, db);
    await member(db, ctx, data.ownerId);
    const existing = await db.task.findUnique({ where: { constructionKey: data.constructionKey } });
    if (existing) { if (existing.companyId !== ctx.company.id || existing.projectId !== projectId) conflict(); return existing; }
    const dueAt = data.dueAt ? new Date(parseWorkspaceDateTime(`${data.dueAt}T23:59`, ctx.company.timezone).getTime() + 59999) : null;
    return db.task.create({ data: { ...data, companyId: ctx.company.id, projectId, customerId: project.customerId, creatorId: ctx.user.id, dueAt } });
  });
}
export async function addReport(ctx: WorkspaceContext, projectId: string, raw: unknown) {
  const data = parse(z.object({ taskId: z.string().optional(), date: text, kind: z.enum(["PROGRESS", "ISSUE", "DEFECT"]), body: text.max(10000), completedQuantity: z.string().transform((v) => quantity(v, true)), operationKey: key }), raw);
  return change(ctx, projectId, false, "report.created", async (db) => {
    const existing = replay(await db.siteReport.findUnique({ where: { companyId_operationKey: { companyId: ctx.company.id, operationKey: data.operationKey } } }), projectId, { completedQuantity: data.completedQuantity, body: data.body });
    if (existing) return existing;
    if (data.kind !== "PROGRESS" && data.completedQuantity !== "0") invalid();
    if (data.taskId) {
      const task = await db.task.findFirst({ where: { id: data.taskId, companyId: ctx.company.id, projectId } });
      if (!task || (!can(ctx.role, "construction.manage") && task.ownerId !== ctx.user.id && (await projectAccess(ctx, projectId, db)).siteLeadId !== ctx.user.id)) missing();
      const reports = await db.siteReport.findMany({ where: { taskId: task.id, companyId: ctx.company.id, projectId, kind: "PROGRESS" } });
      const completed = Decimal.sum(data.completedQuantity, ...reports.map((r) => r.completedQuantity));
      if (!task.plannedQuantity || completed.gt(task.plannedQuantity)) throw new AppError("Quantity exceeds planned work", "C_QUANTITY", 400);
      if (completed.eq(task.plannedQuantity)) await db.task.update({ where: { id: task.id }, data: { status: "DONE", boardStage: "DONE", completedAt: new Date() } });
    } else if (data.completedQuantity !== "0") invalid();
    return db.siteReport.create({ data: { ...data, taskId: data.taskId || null, date: parseDateOnly(data.date), companyId: ctx.company.id, projectId, authorId: ctx.user.id } });
  });
}
export async function resolveReport(ctx: WorkspaceContext, projectId: string, reportId: string) {
  assertCan(ctx.role, "construction.manage");
  return change(ctx, projectId, false, "report.resolved", async (db) => {
    const report = await db.siteReport.findFirst({ where: { id: reportId, projectId, companyId: ctx.company.id } });
    if (!report) missing();
    return db.siteReport.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
  });
}
export async function createPartner(ctx: WorkspaceContext, raw: unknown) {
  assertCan(ctx.role, "construction.finance");
  const data = parse(z.object({ name: text, kind: z.enum(["SUPPLIER", "SUBCONTRACTOR", "BOTH"]), specialty: z.string().max(500).optional(), phone: z.string().optional(), email: z.union([z.email(), z.literal("")]).optional() }), raw);
  return prisma.$transaction(async (db) => {
    const partner = await db.tradePartner.create({ data: { ...data, phone: normalizePhone(data.phone), companyId: ctx.company.id } });
    await audit(db, ctx, "partner.created", partner.id);
    return partner;
  });
}
