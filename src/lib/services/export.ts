import { prisma } from "../db";
import { assertCan } from "../permissions";
import { writeAudit } from "../audit";
import { csvCell } from "../csv";
import type { WorkspaceContext } from "../auth/workspace";

export const EXPORT_VERSION = 2;
const PAGE_SIZE = 200;
type Row = { id: string } & Record<string, unknown>;
type Page = (after?: string) => Promise<Row[]>;

/** Explicit allowlists: new database fields never silently expand the approved payload. */
function exportPages(companyId: string): Record<string, Page> {
  const page = (after?: string) => ({
    orderBy: { id: "asc" as const }, take: PAGE_SIZE,
    where: { companyId, ...(after ? { id: { gt: after } } : {}) },
  });
  return {
    constructionProjects: (after) => prisma.constructionProject.findMany({ ...page(after), select: { stage: true, id: true, companyId: true, number: true, name: true, customerId: true, dealId: true, address: true, workType: true, description: true, managerId: true, siteLeadId: true, startDate: true, endDate: true, status: true, currency: true, contractNumber: true, createdAt: true, updatedAt: true } }),
    constructionEstimates: (after) => prisma.constructionEstimate.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, version: true, status: true, markupBps: true, vatBps: true, extraMinor: true, createdById: true, approvedAt: true, createdAt: true } }),
    estimateLines: (after) => prisma.estimateLine.findMany({ ...page(after), select: { subcontractUnitMinor: true, equipmentUnitMinor: true, id: true, companyId: true, estimateId: true, description: true, unit: true, quantity: true, materialUnitMinor: true, laborUnitMinor: true, otherUnitMinor: true, sortOrder: true } }),
    projectCosts: (after) => prisma.projectCost.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, category: true, description: true, amountMinor: true, date: true, createdById: true, createdAt: true } }),
    projectChanges: (after) => prisma.projectChange.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, title: true, plannedCostMinor: true, netRevenueMinor: true, vatBps: true, status: true, approvedAt: true, createdAt: true } }),
    siteReports: (after) => prisma.siteReport.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, taskId: true, authorId: true, date: true, kind: true, body: true, completedQuantity: true, status: true, createdAt: true } }),
    projectDocuments: (after) => prisma.projectDocument.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, reportId: true, name: true, category: true, mimeType: true, size: true, createdById: true, createdAt: true } }),
    tradePartners: (after) => prisma.tradePartner.findMany({ ...page(after), select: { id: true, companyId: true, name: true, kind: true, specialty: true, phone: true, email: true } }),
    materialRequests: (after) => prisma.materialRequest.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, productId: true, quantity: true, status: true, requestedById: true, createdAt: true } }),
    supplyQuotes: (after) => prisma.supplyQuote.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, requestId: true, partnerId: true, unitMinor: true, notes: true, createdAt: true } }),
    purchaseOrders: (after) => prisma.purchaseOrder.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, requestId: true, partnerId: true, productId: true, quantity: true, unitMinor: true, totalMinor: true, status: true, createdAt: true } }),
    stockMovements: (after) => prisma.stockMovement.findMany({ ...page(after), select: { valueMinor: true, id: true, companyId: true, projectId: true, productId: true, purchaseOrderId: true, kind: true, quantity: true, otherProjectId: true, createdById: true, createdAt: true } }),
    subcontracts: (after) => prisma.subcontract.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, partnerId: true, title: true, unit: true, quantity: true, unitMinor: true, totalMinor: true, status: true, createdAt: true } }),
    subcontractProgress: (after) => prisma.subcontractProgress.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, subcontractId: true, quantity: true, confirmedById: true, date: true } }),
    workAcceptances: (after) => prisma.workAcceptance.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, number: true, status: true, vatBps: true, netMinor: true, vatMinor: true, totalMinor: true, confirmedAt: true, confirmedById: true, createdAt: true } }),
    acceptanceLines: (after) => prisma.acceptanceLine.findMany({ ...page(after), select: { id: true, companyId: true, projectId: true, acceptanceId: true, description: true, unit: true, quantity: true, unitMinor: true, totalMinor: true } }),
    projectPayments: (after) => prisma.projectPayment.findMany({ ...page(after), select: { subcontractId: true, id: true, companyId: true, projectId: true, direction: true, kind: true, amountMinor: true, description: true, date: true, recordedById: true, createdAt: true } }),
    customers: (after) => prisma.customer.findMany({ ...page(after), select: {
      id: true, companyId: true, name: true, taxId: true, legalForm: true, isVatPayer: true,
      bankIban: true, email: true, phone: true, website: true, address: true, ownerId: true,
      archivedAt: true, createdAt: true, updatedAt: true,
    } }),
    contacts: (after) => prisma.contact.findMany({ ...page(after), select: {
      id: true, companyId: true, customerId: true, ownerId: true, firstName: true, lastName: true,
      email: true, phone: true, title: true, archivedAt: true, createdAt: true, updatedAt: true,
    } }),
    leads: (after) => prisma.lead.findMany({ ...page(after), select: {
      id: true, companyId: true, title: true, contactName: true, companyName: true, taxId: true,
      phone: true, email: true, source: true, status: true, amountMinor: true, currency: true,
      notes: true, ownerId: true, convertedCustomerId: true, convertedDealId: true, createdAt: true, updatedAt: true,
    } }),
    pipelineStages: (after) => prisma.pipelineStage.findMany({ ...page(after), select: {
      id: true, companyId: true, name: true, sortOrder: true, isWon: true, isLost: true,
      archivedAt: true, createdAt: true, updatedAt: true,
    } }),
    deals: (after) => prisma.deal.findMany({ ...page(after), select: {
      id: true, companyId: true, title: true, customerId: true, contactId: true, stageId: true,
      ownerId: true, amountMinor: true, currency: true, expectedCloseAt: true, status: true,
      lossReason: true, closedAt: true, archivedAt: true, createdAt: true, updatedAt: true,
    } }),
    tasks: (after) => prisma.task.findMany({ ...page(after), select: {
      id: true, companyId: true, title: true, description: true, status: true, priority: true,
      boardStage: true, checklistJson: true, dueAt: true, completedAt: true, ownerId: true,
      creatorId: true, customerId: true, dealId: true, projectId: true, plannedQuantity: true, workUnit: true, phase: true, createdAt: true, updatedAt: true,
    } }),
    products: (after) => prisma.product.findMany({ ...page(after), select: {
      id: true, companyId: true, sku: true, name: true, description: true, unit: true,
      priceMinor: true, currency: true, vatIncluded: true, isActive: true, createdAt: true, updatedAt: true,
    } }),
    invoices: (after) => prisma.invoice.findMany({ ...page(after), select: {
      id: true, companyId: true, invoiceNumber: true, customerId: true, dealId: true, status: true,
      issueDate: true, dueDate: true, subtotalMinor: true, vatRate: true, vatMinor: true, totalMinor: true,
      projectId: true, acceptanceId: true, vatRateBps: true, currency: true, includeVat: true, bankPreference: true, rsGeWaybillRef: true, notes: true, createdAt: true, updatedAt: true,
    } }),
    invoiceItems: (after) => prisma.invoiceItem.findMany({
      where: { invoice: { companyId }, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" }, take: PAGE_SIZE,
      select: { id: true, invoiceId: true, productId: true, description: true, quantity: true, unit: true, unitMinor: true, totalMinor: true },
    }),
    notes: (after) => prisma.note.findMany({ ...page(after), select: {
      id: true, companyId: true, body: true, authorId: true, customerId: true, contactId: true, dealId: true, createdAt: true, updatedAt: true,
    } }),
    customFields: (after) => prisma.customFieldDefinition.findMany({ ...page(after), select: {
      id: true, companyId: true, name: true, key: true, fieldType: true, options: true, required: true, sortOrder: true, archivedAt: true, createdAt: true, updatedAt: true,
    } }),
    customValues: (after) => prisma.customFieldValue.findMany({ ...page(after), select: {
      id: true, companyId: true, fieldId: true, customerId: true, valueText: true, valueNumber: true, valueDate: true,
    } }),
    memberships: (after) => prisma.membership.findMany({ ...page(after), select: {
      id: true, companyId: true, userId: true, role: true, departmentName: true, jobTitle: true, createdAt: true, updatedAt: true,
    } }),
    users: (after) => prisma.user.findMany({
      where: { memberships: { some: { companyId } }, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" }, take: PAGE_SIZE,
      select: { id: true, name: true, email: true },
    }),
  };
}

async function* pages(fetch: Page) {
  let after: string | undefined;
  while (true) {
    const rows = await fetch(after);
    if (rows.length) yield rows;
    if (rows.length < PAGE_SIZE) break;
    after = rows[rows.length - 1].id;
  }
}

async function* chunks(ctx: WorkspaceContext, format: "json" | "csv") {
  const exports = exportPages(ctx.company.id);
  if (format === "csv") {
    const columns = ["id", "companyId", "name", "taxId", "legalForm", "isVatPayer", "email", "phone", "website", "address", "ownerId", "archivedAt"];
    yield `\uFEFF${columns.map(csvCell).join(",")}\r\n`;
    for await (const rows of pages(exports.customers)) {
      yield rows.map((row) => columns.map((key) => csvCell(row[key])).join(",")).join("\r\n") + "\r\n";
    }
    return;
  }
  const workspace = await prisma.company.findUniqueOrThrow({ where: { id: ctx.company.id }, select: {
    id: true, name: true, slug: true, timezone: true, defaultLocale: true, currency: true,
    taxId: true, legalForm: true, isVatPayer: true, bogIban: true, tbcIban: true, address: true, phone: true,
  } });
  yield JSON.stringify({ schemaVersion: EXPORT_VERSION, exportedAt: new Date().toISOString(), consistency: "paginated-live-read", workspace }).slice(0, -1);
  for (const [entity, fetch] of Object.entries(exports)) {
    yield `,${JSON.stringify(entity)}:[`;
    let first = true;
    for await (const rows of pages(fetch)) {
      yield `${first ? "" : ","}${rows.map((row) => JSON.stringify(row)).join(",")}`;
      first = false;
    }
    yield "]";
  }
  yield "}";
}

export async function exportWorkspace(ctx: WorkspaceContext, format: "json" | "csv") {
  assertCan(ctx.role, "company.export");
  const audit = (action: string) => writeAudit({ companyId: ctx.company.id, actorId: ctx.user.id,
    action, entityType: "workspace_export", detail: { schemaVersion: EXPORT_VERSION, format } });
  await audit("export.requested");
  const iterator = chunks(ctx, format);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) {
          await audit("export.completed");
          controller.close();
        } else controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        await audit("export.failed");
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return();
      await audit("export.cancelled");
    },
  }, { highWaterMark: 0 });
}
