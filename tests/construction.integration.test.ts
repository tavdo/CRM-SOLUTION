import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { WorkspaceContext } from "../src/lib/auth/workspace";

const fixture = vi.hoisted(() => ({ file: `${process.cwd().replaceAll("\\", "/")}/prisma/construction-test-${process.pid}-${Date.now()}.db` }));
vi.mock("../src/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: `file:${fixture.file}?connection_limit=1` }) };
});
import { prisma } from "../src/lib/db";
import * as core from "../src/lib/construction/core";
import * as ledger from "../src/lib/construction/ledger";
import { projectWorkspace, projectFinance } from "../src/lib/construction/read";
import { projectAccess } from "../src/lib/construction/access";
import { minor, quantity, lineAmount, tax, estimateTotals } from "../src/lib/construction/math";
import { fileType, readDocument, saveDocument } from "../src/lib/construction/documents";
import { completeTask } from "../src/lib/services/tasks";
import { getInvoice, listInvoices } from "../src/lib/services/invoices";
import { exportWorkspace } from "../src/lib/services/export";

describe("contractor operations on an isolated migrated database", () => {
  let admin: WorkspaceContext;
  let worker: WorkspaceContext;
  let stranger: WorkspaceContext;
  let p: string;
  let target: string;
  let foreign: string;
  let supplier: string;
  let subcontractor: string;
  beforeAll(async () => {
    const migrations = readdirSync("prisma/migrations").filter((n) => /^\d/.test(n)).sort();
    for (const migration of migrations) {
      // Insert representative legacy records before the construction migration, then verify preservation.
      if (migration === "20261104100000_contractor_workspace") {
        await prisma.$executeRawUnsafe(`INSERT INTO "Company" ("id", "name", "slug", "updatedAt") VALUES ('a', 'Contractor', 'contractor-a', CURRENT_TIMESTAMP), ('b', 'Other', 'contractor-b', CURRENT_TIMESTAMP)`);
        await prisma.$executeRawUnsafe(`INSERT INTO "User" ("id", "name", "email", "passwordHash", "updatedAt") VALUES ('admin', 'Admin', 'admin@test.local', 'excluded', CURRENT_TIMESTAMP), ('worker', 'Worker', 'worker@test.local', 'excluded', CURRENT_TIMESTAMP), ('stranger', 'Stranger', 'stranger@test.local', 'excluded', CURRENT_TIMESTAMP)`);
        await prisma.$executeRawUnsafe(`INSERT INTO "Customer" ("id", "companyId", "name", "ownerId", "updatedAt") VALUES ('client', 'a', 'Preserved client', 'worker', CURRENT_TIMESTAMP), ('foreign-client', 'b', 'Foreign client', 'stranger', CURRENT_TIMESTAMP)`);
        await prisma.$executeRawUnsafe(`INSERT INTO "Task" ("id", "companyId", "title", "ownerId", "creatorId", "updatedAt") VALUES ('legacy-task', 'a', 'Preserved task', 'worker', 'admin', CURRENT_TIMESTAMP)`);
        await prisma.$executeRawUnsafe(`INSERT INTO "Invoice" ("id", "companyId", "invoiceNumber", "customerId", "totalMinor", "updatedAt") VALUES ('legacy-invoice', 'a', 'LEGACY', 'client', 12345, CURRENT_TIMESTAMP)`);
        await prisma.$executeRawUnsafe(`INSERT INTO "AutomationRule" ("id", "companyId", "name", "triggerStageId", "actionType", "actionDetail") VALUES ('old-feed-rule', 'a', 'Preserved inactive rule', 'unused', 'POST_FEED', 'legacy')`);
      }
      for (const sql of readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8").split(";").map((s) => s.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(sql);
    }
    const company = await prisma.company.findUniqueOrThrow({ where: { id: "a" } });
    for (const [id, role] of [["admin", "ADMIN"], ["worker", "EMPLOYEE"], ["stranger", "EMPLOYEE"]] as const) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id } });
      const membership = await prisma.membership.create({ data: { companyId: "a", userId: id, role } });
      const ctx = { company, user, membership, role, subscription: null };
      if (id === "admin") admin = ctx;
      else if (id === "worker") worker = ctx;
      else stranger = ctx;
    }
    for (const [id, cid] of [["material", "a"], ["foreign-material", "b"]]) await prisma.product.create({ data: { id, companyId: cid, name: id, priceMinor: 999999, unit: "m³" } });
    p = (await core.createProject(admin, { name: "House construction", number: "P-1", customerId: "client", address: "Tbilisi", workType: "House", managerId: "admin", siteLeadId: "worker" })).id;
    target = (await core.createProject(admin, { name: "Office renovation", number: "P-2", customerId: "client", address: "Tbilisi", workType: "Renovation", managerId: "admin" })).id;
    foreign = (await prisma.constructionProject.create({ data: { companyId: "b", number: "B-1", name: "Other tenant", customerId: "foreign-client", address: "Private", workType: "Other", managerId: "stranger" } })).id;
    supplier = (await core.createPartner(admin, { name: "Supplier", kind: "SUPPLIER" })).id;
    subcontractor = (await core.createPartner(admin, { name: "Electrician", kind: "SUBCONTRACTOR" })).id;
  }, 60000);
  afterAll(async () => { await prisma.$disconnect(); for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(fixture.file + suffix, { force: true }); });

  it("preserves legacy tasks, invoices and automation history during migration", async () => {
    expect(await prisma.task.findUnique({ where: { id: "legacy-task" } })).toMatchObject({ title: "Preserved task", projectId: null });
    expect(await prisma.invoice.findUnique({ where: { id: "legacy-invoice" } })).toMatchObject({ totalMinor: 12345, projectId: null, acceptanceId: null });
    expect(await prisma.automationRule.findUnique({ where: { id: "old-feed-rule" } })).toMatchObject({ actionType: "POST_FEED", isActive: false });
  });
  it("separates assigned project access from finance and blocks tenant/forged links", async () => {
    await core.updateProject(admin, p, { name: "House construction", address: "Tbilisi", workType: "House", status: "ACTIVE", stage: "EXECUTION", managerId: "admin", siteLeadId: "worker", description: "Site work", contractNumber: "TEST-1" });
    expect(await projectAccess(worker, p)).toMatchObject({ id: p, stage: "EXECUTION", status: "ACTIVE" });
    await expect(projectAccess(stranger, p)).rejects.toMatchObject({ status: 404 });
    await expect(projectAccess(admin, foreign)).rejects.toMatchObject({ status: 404 });
    await expect(projectFinance(worker, p)).rejects.toMatchObject({ status: 403 });
    await expect(core.recordCost(worker, p, { category: "LABOR", description: "No", amountMinor: "1", date: "2026-11-04", operationKey: randomUUID() })).rejects.toMatchObject({ status: 403 });
    await expect(core.createProject(admin, { name: "Forged", number: "X", customerId: "foreign-client", address: "X", workType: "X", managerId: "admin" })).rejects.toMatchObject({ status: 404 });
    await expect(ledger.requestMaterial(worker, p, { productId: "foreign-material", quantity: "1", operationKey: randomUUID() })).rejects.toMatchObject({ status: 404 });
    const data = await projectWorkspace(worker, p);
    expect(data.finance).toBeNull();
    expect(JSON.stringify(data.products)).not.toContain("priceMinor");
    expect(JSON.stringify(data.stock)).not.toContain("valueMinor");
  });
  it("calculates decimal quantities and money with half-up rounding and bounds", () => {
    expect(minor("0.29")).toBe(29);
    expect(quantity("1.250")).toBe("1.25");
    expect(lineAmount("0.125", 100)).toBe(13);
    expect(tax(101, 1800)).toBe(18);
    expect(estimateTotals([{ quantity: "0.125", materialUnitMinor: 100, laborUnitMinor: 200, otherUnitMinor: 0 }], 10, 1000, 1800)).toEqual({ material: 13, labor: 25, other: 10, subcontract: 0, equipment: 0, cost: 48, markup: 5, net: 53, vat: 10, total: 63 });
    for (const value of ["-1", "0", "1.2345", "1e2", "Infinity"]) expect(() => quantity(value)).toThrow();
    expect(() => minor("21474836.48")).toThrow();
  });
  it("freezes approved estimates, revisions preserve history and old baselines", async () => {
    const input = { operationKey: randomUUID(), markupBps: "10", vatBps: "0", extraMinor: "0" };
    const estimate = await core.createEstimate(admin, p, input);
    expect((await core.createEstimate(admin, p, input)).id).toBe(estimate.id);
    const row = { estimateId: estimate.id, description: "Walls", unit: "m²", quantity: "10.125", materialUnitMinor: "12.34", laborUnitMinor: "5", otherUnitMinor: "0" };
    await core.addEstimateLine(admin, p, row);
    await core.approveEstimate(admin, p, estimate.id);
    await expect(core.addEstimateLine(admin, p, row)).rejects.toMatchObject({ code: "C_CONFLICT" });
    await expect(core.editEstimate(admin, p, { estimateId: estimate.id, markupBps: "20", vatBps: "0", extraMinor: "0" })).rejects.toMatchObject({ code: "C_CONFLICT" });
    const revision = await core.createEstimate(admin, p, { ...input, operationKey: randomUUID(), revisionId: estimate.id });
    expect(revision.version).toBe(2);
    expect((await projectFinance(admin, p)).estimates.find((e) => e.status === "APPROVED")?.id).toBe(estimate.id);
    const line = await prisma.estimateLine.findFirstOrThrow({ where: { estimateId: revision.id } });
    await core.removeEstimateLine(admin, p, { estimateId: revision.id, lineId: line.id });
    await core.addEstimateLine(admin, p, { ...row, estimateId: revision.id, quantity: "20.25" });
    await core.approveEstimate(admin, p, revision.id);
    expect((await prisma.constructionEstimate.findUniqueOrThrow({ where: { id: estimate.id } })).status).toBe("SUPERSEDED");
    expect((await prisma.estimateLine.findFirstOrThrow({ where: { estimateId: estimate.id } })).quantity).toBe("10.125");
  });
  it("plans all five cost categories and allocates subcontract payments", async () => {
    const estimate = await core.createEstimate(admin, target, { operationKey: randomUUID(), markupBps: "0", vatBps: "0", extraMinor: "0" });
    await core.addEstimateLine(admin, target, { estimateId: estimate.id, description: "Installation", quantity: "1.5", unit: "h", materialUnitMinor: "1", laborUnitMinor: "2", subcontractUnitMinor: "3", equipmentUnitMinor: "4", otherUnitMinor: "5" });
    await core.approveEstimate(admin, target, estimate.id);
    const f = await projectFinance(admin, target);
    expect(f.budget.categories.map((c) => c.planned)).toEqual([150, 300, 450, 600, 750]);
    expect(f.budget.planCost).toBe(2250);
    const agreement = await ledger.createSubcontract(admin, target, { partnerId: subcontractor, title: "Test agreement", unit: "h", quantity: "1", unitMinor: "3" });
    const payment = { direction: "OUT", kind: "ADVANCE", amountMinor: "1", description: "Agreement advance", date: "2026-11-04", subcontractId: agreement.id, operationKey: randomUUID() };
    const first = await ledger.recordPayment(admin, target, payment);
    expect((await ledger.recordPayment(admin, target, payment)).id).toBe(first.id);
    await expect(ledger.recordPayment(admin, p, { ...payment, operationKey: randomUUID() })).rejects.toMatchObject({ status: 404 });
    expect((await projectFinance(admin, target)).payments[0].subcontractId).toBe(agreement.id);
  });
  it("converts a won order once with no client re-entry", async () => {
    const stage = await prisma.pipelineStage.create({ data: { companyId: "a", name: "Agreed", isWon: true, sortOrder: 4 } });
    const deal = await prisma.deal.create({ data: { companyId: "a", title: "Agreed facade", stageId: stage.id, customerId: "client", ownerId: "admin", status: "WON", currency: "USD" } });
    const first = await core.projectFromDeal(admin, deal.id);
    expect(await core.projectFromDeal(admin, deal.id)).toMatchObject({ id: first.id, customerId: "client", currency: "USD", name: "Agreed facade" });
    await expect(core.projectFromDeal(worker, deal.id)).rejects.toMatchObject({ status: 403 });
  });
  it("records daily decimal work once and prevents over-reporting", async () => {
    const work = await core.createWork(admin, p, { title: "Floor", phase: "Foundations", dueAt: "2026-11-04", ownerId: "worker", plannedQuantity: "0.3", workUnit: "m²", constructionKey: randomUUID() });
    expect(work.dueAt?.toISOString()).toBe("2026-11-04T19:59:59.999Z");
    await expect(completeTask(worker, work.id)).rejects.toMatchObject({ code: "C_QUANTITY" });
    const report = { taskId: work.id, date: "2026-11-04", kind: "PROGRESS", body: "First area", completedQuantity: "0.1", operationKey: randomUUID() };
    const first = await core.addReport(worker, p, report);
    expect((await core.addReport(worker, p, report)).id).toBe(first.id);
    await core.addReport(worker, p, { ...report, completedQuantity: "0.2", operationKey: randomUUID() });
    await expect(core.addReport(worker, p, { ...report, operationKey: randomUUID() })).rejects.toMatchObject({ code: "C_QUANTITY" });
    expect((await projectWorkspace(worker, p)).work.find((w) => w.id === work.id)).toMatchObject({ status: "DONE", phase: "Foundations", progress: 100, completedQuantity: "0.3" });
  });
  it("posts purchase cost once, rounds split receipts cumulatively and transfers stock/value", async () => {
    const request = await ledger.requestMaterial(worker, p, { productId: "material", quantity: "0.3", operationKey: randomUUID() });
    const quote = await ledger.addSupplyQuote(admin, p, { requestId: request.id, partnerId: supplier, unitMinor: "0.05" });
    const order = await ledger.orderQuote(admin, p, quote.id);
    expect((await ledger.orderQuote(admin, p, quote.id)).id).toBe(order.id);
    expect(order.totalMinor).toBe(2);
    const receipt = { orderId: order.id, quantity: "0.1", operationKey: randomUUID() };
    const first = await ledger.receiveOrder(admin, p, receipt);
    expect((await ledger.receiveOrder(admin, p, receipt)).id).toBe(first.id);
    await ledger.receiveOrder(admin, p, { ...receipt, operationKey: randomUUID() });
    await ledger.receiveOrder(admin, p, { ...receipt, operationKey: randomUUID() });
    expect(await prisma.projectCost.aggregate({ where: { projectId: p, category: "MATERIAL" }, _sum: { amountMinor: true } })).toMatchObject({ _sum: { amountMinor: 2 } });
    await expect(ledger.receiveOrder(admin, p, { ...receipt, operationKey: randomUUID() })).rejects.toMatchObject({ code: "C_QUANTITY" });
    await expect(ledger.moveStock(admin, p, { productId: "material", quantity: "0.4", kind: "USE", operationKey: randomUUID() })).rejects.toMatchObject({ code: "C_STOCK" });
    await expect(ledger.moveStock(admin, p, { productId: "material", quantity: "0.1", kind: "TRANSFER", otherProjectId: foreign, operationKey: randomUUID() })).rejects.toMatchObject({ status: 404 });
    const usd = await prisma.constructionProject.create({ data: { companyId: "a", number: "USD-1", name: "USD project", customerId: "client", address: "Tbilisi", workType: "Test", managerId: "admin", currency: "USD" } });
    await expect(ledger.moveStock(admin, p, { productId: "material", quantity: "0.1", kind: "TRANSFER", otherProjectId: usd.id, operationKey: randomUUID() })).rejects.toMatchObject({ code: "C_CURRENCY" });
    const transfer = { productId: "material", quantity: "0.3", kind: "TRANSFER", otherProjectId: target, operationKey: randomUUID() };
    const move = await ledger.moveStock(admin, p, transfer);
    expect((await ledger.moveStock(admin, p, transfer)).id).toBe(move.id);
    expect((await projectWorkspace(admin, p)).stock.find((s) => s.id === "material")?.balance).toBe("0");
    expect((await projectWorkspace(admin, target)).stock.find((s) => s.id === "material")?.balance).toBe("0.3");
    expect((await projectFinance(admin, target)).budget.actual).toBe(2);
    expect((await projectFinance(admin, p)).costs.filter((c) => c.category === "MATERIAL").reduce((s, c) => s + c.amountMinor, 0)).toBe(0);
    await ledger.moveStock(admin, target, { productId: "material", quantity: "0.2", kind: "USE", operationKey: randomUUID() });
    await ledger.moveStock(admin, target, { productId: "material", quantity: "0.1", kind: "RETURN", operationKey: randomUUID() });
    await expect(ledger.moveStock(admin, target, { productId: "material", quantity: "0.2", kind: "RETURN", operationKey: randomUUID() })).rejects.toMatchObject({ code: "C_QUANTITY" });
    expect((await projectWorkspace(admin, target)).stock.find((s) => s.id === "material")?.balance).toBe("0.2");
  });
  it("confirms subcontract volume once and prevents exceeding the agreement", async () => {
    const agreement = await ledger.createSubcontract(admin, p, { partnerId: subcontractor, title: "Wiring", unit: "m", quantity: "0.3", unitMinor: "0.05" });
    const input = { subcontractId: agreement.id, quantity: "0.1", date: "2026-11-04", operationKey: randomUUID() };
    const first = await ledger.confirmSubcontractProgress(admin, p, input);
    expect((await ledger.confirmSubcontractProgress(admin, p, input)).id).toBe(first.id);
    await ledger.confirmSubcontractProgress(admin, p, { ...input, quantity: "0.2", operationKey: randomUUID() });
    await expect(ledger.confirmSubcontractProgress(admin, p, { ...input, operationKey: randomUUID() })).rejects.toMatchObject({ code: "C_QUANTITY" });
    expect((await projectFinance(admin, p)).costs.filter((c) => c.category === "SUBCONTRACT").reduce((s, c) => s + c.amountMinor, 0)).toBe(agreement.totalMinor);
  });
  it("creates/confirms/invoices acts and records payments idempotently without leaking finance", async () => {
    const input = { number: "ACT-1", vatBps: "18.5", operationKey: randomUUID(), lines: [{ description: "Walls", unit: "m²", quantity: "1.125", unitMinor: "2.20" }] };
    const act = await ledger.createAcceptance(admin, p, input);
    expect((await ledger.createAcceptance(admin, p, input)).id).toBe(act.id);
    expect(act).toMatchObject({ netMinor: 248, vatMinor: 46, totalMinor: 294 });
    await expect(ledger.invoiceAcceptance(admin, p, act.id)).rejects.toMatchObject({ status: 404 });
    await expect(ledger.createAcceptance(admin, p, { ...input, lines: [{ ...input.lines[0], description: "Changed payload" }] })).rejects.toMatchObject({ code: "C_CONFLICT" });
    await ledger.confirmAcceptance(admin, p, act.id);
    await ledger.confirmAcceptance(admin, p, act.id);
    const invoice = await ledger.invoiceAcceptance(admin, p, act.id);
    expect((await ledger.invoiceAcceptance(admin, p, act.id)).id).toBe(invoice.id);
    expect(invoice).toMatchObject({ totalMinor: 294, vatRateBps: 1850, projectId: p });
    await expect(getInvoice(worker, invoice.id)).rejects.toMatchObject({ status: 404 });
    expect((await listInvoices(worker)).some((i) => i.id === invoice.id)).toBe(false);
    const payment = { direction: "IN", kind: "ADVANCE", amountMinor: "1.23", description: "Manual receipt", date: "2026-11-04", operationKey: randomUUID() };
    const first = await ledger.recordPayment(admin, p, payment);
    expect((await ledger.recordPayment(admin, p, payment)).id).toBe(first.id);
    await expect(ledger.recordPayment(admin, p, { ...payment, amountMinor: "4.56" })).rejects.toMatchObject({ code: "C_CONFLICT" });
    expect((await projectFinance(admin, p)).budget).toMatchObject({ received: 123, certified: 294, certifiedBalance: 171 });
    expect(await prisma.auditEvent.count({ where: { companyId: "a", action: "construction.payment.recorded_manually" } })).toBeGreaterThan(0);
  });
  it("validates file types and protects financial documents and foreign downloads", async () => {
    expect(fileType(Buffer.from("<svg onload='x'>"))).toBeNull();
    expect(fileType(Buffer.from("%PDF-1.7"))?.mime).toBe("application/pdf");
    await expect(saveDocument(worker, p, { category: "CONTRACT" }, new File(["%PDF-1.7"], "contract.pdf"))).rejects.toMatchObject({ status: 403 });
    await expect(saveDocument(worker, p, { category: "PHOTO" }, new File(["<svg>"], "photo.jpg"))).rejects.toMatchObject({ code: "C_FILE" });
    const d = await prisma.projectDocument.create({ data: { companyId: "a", projectId: p, category: "CONTRACT", storageKey: "private.pdf", name: "Contract", mimeType: "application/pdf", size: 8, createdById: "admin" } });
    await expect(readDocument(worker, d.id)).rejects.toMatchObject({ status: 403 });
    expect((await projectWorkspace(worker, p)).documents).toEqual([]);
    await expect(readDocument({ ...admin, company: { ...admin.company, id: "b" } }, d.id)).rejects.toMatchObject({ status: 404 });
  });
  it("exports authorized construction records and relationships with private file paths excluded", async () => {
    const raw = await new Response(await exportWorkspace(admin, "json")).text();
    const data = JSON.parse(raw);
    expect(data.schemaVersion).toBe(2);
    expect(data.constructionProjects.some((row: { id: string }) => row.id === p)).toBe(true);
    expect(data.projectPayments).toHaveLength(2);
    expect(raw).not.toMatch(/passwordHash|storageKey|private\.pdf|Foreign client|operationKey/);
    await expect(exportWorkspace(worker, "json")).rejects.toMatchObject({ status: 403 });
  });
});
