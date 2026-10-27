import { prisma } from "../db";
import { AppError } from "../errors";
import { can, canAccessOwnedRecord } from "../permissions";
import { visibleRelation, customerOwnerScope } from "../scope";
import { toMinor } from "../money";
import { writeAudit } from "../audit";
import type { WorkspaceContext } from "../auth/workspace";

export async function listInvoices(ctx: WorkspaceContext) {
  const records = await prisma.invoice.findMany({
    where: {
      companyId: ctx.company.id,
      ...customerOwnerScope(ctx),
    },
    include: { customer: true, deal: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  return records.map((record) => ({ ...record, deal: visibleRelation(ctx, record.deal) }));
}

export async function getInvoice(ctx: WorkspaceContext, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      companyId: ctx.company.id,
      ...customerOwnerScope(ctx),
    },
    include: { customer: true, deal: true, items: true },
  });
  if (!invoice) throw new AppError("Not found", "NOT_FOUND", 404);
  return { ...invoice, deal: visibleRelation(ctx, invoice.deal) };
}

async function assertCustomerAccess(ctx: WorkspaceContext, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: ctx.company.id, archivedAt: null },
  });
  if (!customer) throw new AppError("Customer not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, customer.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return customer;
}

export async function createInvoice(
  ctx: WorkspaceContext,
  input: {
    customerId: string;
    dealId?: string | null;
    productId?: string | null;
    asQuote?: boolean;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: string;
    includeVat?: boolean;
    rsGeWaybillRef?: string | null;
    notes?: string;
  },
) {
  if (!can(ctx.role, "crm.create")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const customer = await assertCustomerAccess(ctx, input.customerId);

  let dealId: string | null = null;
  if (input.dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: input.dealId, companyId: ctx.company.id },
    });
    if (!deal) throw new AppError("Deal not found", "NOT_FOUND", 404);
    if (!canAccessOwnedRecord(ctx.role, deal.ownerId, ctx.user.id)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }
    if (deal.customerId && deal.customerId !== customer.id) {
      throw new AppError("Deal does not belong to this customer", "BAD_REQUEST", 400);
    }
    dealId = deal.id;
  }

  let unitPriceMinor = toMinor(input.unitPrice || "0");
  let unit = input.unit || "პაკეტი";
  let lineDescription = input.description || "CRM Services / მომსახურება";
  let productId: string | null = null;

  if (input.productId) {
    const product = await prisma.product.findFirst({
      where: {
        id: input.productId,
        companyId: ctx.company.id,
        isActive: true,
      },
    });
    if (!product) throw new AppError("Product not found", "NOT_FOUND", 404);
    unitPriceMinor = product.priceMinor;
    unit = product.unit;
    lineDescription = product.name;
    productId = product.id;
  }

  const quantity = input.quantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || unitPriceMinor < 0) {
    throw new AppError("Invalid quantity or price", "VALIDATION", 400);
  }
  const includeVat = input.includeVat !== false;
  const subtotalMinor = quantity * unitPriceMinor;
  const vatRate = 18;
  const vatMinor = includeVat ? Math.round(subtotalMinor * 0.18) : 0;
  const totalMinor = subtotalMinor + vatMinor;
  if (![subtotalMinor, vatMinor, totalMinor].every((value) => Number.isSafeInteger(value) && value <= 2147483647)) {
    throw new AppError("Invoice total exceeds the supported range", "VALIDATION", 400);
  }

  const count = await prisma.invoice.count({ where: { companyId: ctx.company.id } });
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(3, "0");
  const asQuote = Boolean(input.asQuote);
  const invoiceNumber = asQuote ? `QTE-${year}-${seq}` : `INV-${year}-${seq}`;

  const inv = await prisma.invoice.create({
    data: {
      companyId: ctx.company.id,
      invoiceNumber,
      customerId: customer.id,
      dealId,
      status: asQuote ? "QUOTE" : "DRAFT",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      subtotalMinor,
      vatRate,
      vatMinor,
      totalMinor,
      currency: ctx.company.currency,
      includeVat,
      rsGeWaybillRef: input.rsGeWaybillRef || null,
      notes:
        input.notes ||
        (asQuote
          ? "Quote — valid 14 days. Not an invoice."
          : "Pay using the IBANs listed on the company profile when configured."),
      items: {
        create: [
          {
            productId,
            description: lineDescription,
            quantity,
            unit,
            unitMinor: unitPriceMinor,
            totalMinor: subtotalMinor,
          },
        ],
      },
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: asQuote ? "quote.created" : "invoice.created",
    entityType: "invoice",
    entityId: inv.id,
  });

  return inv;
}

export async function convertQuoteToInvoice(ctx: WorkspaceContext, id: string) {
  const inv = await getInvoice(ctx, id);
  if (inv.status !== "QUOTE") {
    throw new AppError("Not a quote", "BAD_REQUEST", 400);
  }

  const count = await prisma.invoice.count({
    where: { companyId: ctx.company.id, status: { not: "QUOTE" } },
  });
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

  const updated = await prisma.invoice.update({
    where: { id: inv.id },
    data: {
      status: "DRAFT",
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: inv.notes
        ? `${inv.notes}\nConverted from quote ${inv.invoiceNumber}.`
        : `Converted from quote ${inv.invoiceNumber}.`,
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "quote.converted_to_invoice",
    entityType: "invoice",
    entityId: id,
    detail: { from: inv.invoiceNumber, to: invoiceNumber },
  });

  return updated;
}

export async function updateInvoiceStatus(
  ctx: WorkspaceContext,
  id: string,
  status: string,
) {
  const inv = await getInvoice(ctx, id);
  const allowed = ["DRAFT", "SENT", "PAID", "OVERDUE", "QUOTE"];
  if (!allowed.includes(status)) {
    throw new AppError("Invalid status", "BAD_REQUEST", 400);
  }
  if (status === "PAID" && inv.status === "QUOTE") {
    throw new AppError("Convert the quote to an invoice first", "BAD_REQUEST", 400);
  }
  return prisma.invoice.update({ where: { id: inv.id }, data: { status } });
}
