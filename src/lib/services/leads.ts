import { normalizePhone, normalizeText, samePhone } from "../normalization";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { can, canAccessOwnedRecord } from "../permissions";
import { toMinor } from "../money";
import type { WorkspaceContext } from "../auth/workspace";

function ownerFilter(ctx: WorkspaceContext): Prisma.LeadWhereInput {
  if (can(ctx.role, "crm.all")) return {};
  return { ownerId: ctx.user.id };
}

export async function listLeads(
  ctx: WorkspaceContext,
  opts?: { status?: string; source?: string; take?: number },
) {
  return prisma.lead.findMany({
    where: {
      companyId: ctx.company.id,
      ...ownerFilter(ctx),
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.source ? { source: opts.source } : {}),
    },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    ...(opts?.take ? { take: opts.take } : {}),
  });
}

export async function leadStatusCounts(ctx: WorkspaceContext) {
  const rows = await prisma.lead.groupBy({
    by: ["status"],
    where: { companyId: ctx.company.id, ...ownerFilter(ctx) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

export async function findDuplicateLead(
  ctx: WorkspaceContext,
  input: { email?: string | null; phone?: string | null },
) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone);
  return duplicateInScope(ctx.company.id, ownerFilter(ctx), email, phone);

}

export async function createLead(
  ctx: WorkspaceContext,
  input: {
    title: string;
    contactName: string;
    companyName?: string;
    taxId?: string;
    phone?: string;
    email?: string;
    source?: string;
    amount?: string | number;
    notes?: string;
    ownerId?: string;
    forceDuplicate?: boolean;
  },
) {
  if (!can(ctx.role, "crm.create")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone);

  if (!input.forceDuplicate) {
    const dup = await findDuplicateLead(ctx, { email, phone });
    if (dup) {
      throw new AppError(
        `Possible duplicate lead: ${dup.title} (${dup.owner?.name ?? "unassigned"})`,
        "DUPLICATE",
        409,
      );
    }
  }

  let ownerId = ctx.user.id;
  if (input.ownerId && input.ownerId !== ctx.user.id) {
    if (!can(ctx.role, "crm.assign")) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }
    const member = await prisma.membership.findFirst({
      where: { companyId: ctx.company.id, userId: input.ownerId },
    });
    if (!member) throw new AppError("Owner not in workspace", "BAD_REQUEST", 400);
    ownerId = input.ownerId;
  }

  const lead = await prisma.lead.create({
    data: {
      companyId: ctx.company.id,
      title: normalizeText(input.title),
      contactName: normalizeText(input.contactName),
      companyName: input.companyName?.trim() || null,
      taxId: input.taxId?.trim() || null,
      phone,
      email,
      source: input.source || "WEBSITE",
      status: "NEW",
      amountMinor: toMinor(input.amount ?? 0),
      currency: ctx.company.currency,
      notes: input.notes?.trim() || null,
      ownerId,
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "lead.created",
    entityType: "lead",
    entityId: lead.id,
    detail: { source: lead.source, ownerId },
  });

  return lead;
}

export async function updateLeadStatus(
  ctx: WorkspaceContext,
  leadId: string,
  status: string,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: ctx.company.id },
  });
  if (!lead) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, lead.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return prisma.lead.update({ where: { id: leadId }, data: { status } });
}

export async function assignLeadOwner(
  ctx: WorkspaceContext,
  leadId: string,
  ownerId: string,
) {
  if (!can(ctx.role, "crm.assign")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: ctx.company.id },
  });
  if (!lead) throw new AppError("Not found", "NOT_FOUND", 404);

  const member = await prisma.membership.findFirst({
    where: { companyId: ctx.company.id, userId: ownerId },
  });
  if (!member) throw new AppError("Owner not in workspace", "BAD_REQUEST", 400);

  return prisma.lead.update({ where: { id: leadId }, data: { ownerId } });
}

export async function convertLead(ctx: WorkspaceContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: ctx.company.id },
  });
  if (!lead) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, lead.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  if (lead.status === "CONVERTED") {
    throw new AppError("Already converted", "CONFLICT", 409);
  }

  const firstStage = await prisma.pipelineStage.findFirst({
    where: {
      companyId: ctx.company.id,
      archivedAt: null,
      isWon: false,
      isLost: false,
    },
    orderBy: { sortOrder: "asc" },
  });
  if (!firstStage) throw new AppError("No pipeline stage", "BAD_REQUEST", 400);

  const ownerId = lead.ownerId ?? ctx.user.id;

  const customer = await prisma.customer.create({
    data: {
      companyId: ctx.company.id,
      name: lead.companyName || lead.contactName,
      taxId: lead.taxId,
      legalForm: "შპს",
      phone: lead.phone,
      email: lead.email,
      ownerId,
    },
  });

  const nameParts = lead.contactName.split(" ");
  await prisma.contact.create({
    data: {
      companyId: ctx.company.id,
      customerId: customer.id,
      firstName: nameParts[0] || lead.contactName,
      lastName: nameParts.slice(1).join(" ") || "—",
      phone: lead.phone,
      email: lead.email,
      ownerId,
    },
  });

  const deal = await prisma.deal.create({
    data: {
      companyId: ctx.company.id,
      title: lead.title,
      customerId: customer.id,
      stageId: firstStage.id,
      ownerId,
      amountMinor: lead.amountMinor,
      currency: lead.currency,
      expectedCloseAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: "CONVERTED",
      convertedCustomerId: customer.id,
      convertedDealId: deal.id,
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "lead.converted",
    entityType: "lead",
    entityId: lead.id,
    detail: { customerId: customer.id, dealId: deal.id },
  });

  return { customer, deal };
}

/** Public inbound (web form) — no session; scoped by company slug. */
export async function createInboundLead(input: {
  companySlug: string;
  contactName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  message?: string;
  title?: string;
}) {
  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });
  if (!company) throw new AppError("Workspace not found", "NOT_FOUND", 404);

  const contactName = normalizeText(input.contactName);
  if (!contactName) throw new AppError("Name required", "BAD_REQUEST", 400);

  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone);

  const dup = await duplicateInScope(company.id, {}, email, phone);
  // Public submissions never overwrite an existing record's notes.
  if (dup) return { leadId: dup.id, duplicate: true as const };

  const admin = await prisma.membership.findFirst({
    where: { companyId: company.id, role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  const lead = await prisma.lead.create({
    data: {
      companyId: company.id,
      title: input.title?.trim() || `Web form: ${contactName}`,
      contactName,
      companyName: input.companyName?.trim() || null,
      email,
      phone,
      source: "WEBSITE",
      status: "NEW",
      notes: input.message?.trim() || null,
      currency: company.currency,
      ownerId: admin?.userId ?? null,
    },
  });

  await writeAudit({
    companyId: company.id,
    actorId: null,
    action: "lead.inbound_webform",
    entityType: "lead",
    entityId: lead.id,
    detail: { source: "WEBSITE" },
  });

  return { leadId: lead.id, duplicate: false as const };
}

async function duplicateInScope(companyId: string, scope: Prisma.LeadWhereInput, email: string | null, phone: string | null) {
  if (!email && !phone) return null;
  let cursor: string | undefined;
  while (true) {
    const rows = await prisma.lead.findMany({
      where: { AND: [{ companyId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } }, scope],
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone: { not: null } }] : [])] },
      include: { owner: { select: { name: true } } },
      orderBy: { id: "asc" }, take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const duplicate = rows.find((row) => (email && row.email?.toLowerCase() === email) || samePhone(phone, row.phone));
    if (duplicate) return duplicate;
    if (rows.length < 200) return null;
    cursor = rows[rows.length - 1].id;
  }
}
