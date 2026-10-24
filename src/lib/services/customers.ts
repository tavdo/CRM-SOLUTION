import { prisma } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { enforcePlanLimit } from "../billing/adapter";
import { can, canAccessOwnedRecord } from "../permissions";
import type { WorkspaceContext } from "../auth/workspace";
import type { CustomFieldType, Prisma } from "@prisma/client";

function ownerFilter(ctx: WorkspaceContext): Prisma.CustomerWhereInput {
  if (can(ctx.role, "crm.all")) return {};
  return { ownerId: ctx.user.id };
}

export async function listCustomers(
  ctx: WorkspaceContext,
  opts: {
    q?: string;
    page?: number;
    pageSize?: number;
    archived?: boolean;
    sort?: "name" | "createdAt" | "updatedAt";
    order?: "asc" | "desc";
  },
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const where: Prisma.CustomerWhereInput = {
    companyId: ctx.company.id,
    archivedAt: opts.archived ? { not: null } : null,
    ...ownerFilter(ctx),
  };
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const sort = opts.sort ?? "updatedAt";
  const order = opts.order ?? "desc";

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCustomer(ctx: WorkspaceContext, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: ctx.company.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { where: { archivedAt: null }, orderBy: { lastName: "asc" } },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: { select: { id: true, name: true } } },
      },
      customValues: { include: { field: true } },
      deals: {
        where: { archivedAt: null },
        include: { stage: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  });
  if (!customer) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, customer.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return customer;
}

export async function createCustomer(
  ctx: WorkspaceContext,
  input: {
    name: string;
    taxId?: string;
    legalForm?: string;
    bankIban?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    ownerId?: string;
  },
) {
  if (!can(ctx.role, "crm.create")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  await enforcePlanLimit(ctx.company.id, "customers");

  const ownerId =
    can(ctx.role, "crm.assign") && input.ownerId
      ? await assertMemberOwner(ctx.company.id, input.ownerId)
      : ctx.user.id;

  const customer = await prisma.customer.create({
    data: {
      companyId: ctx.company.id,
      name: input.name.trim(),
      taxId: input.taxId?.trim() || null,
      legalForm: input.legalForm?.trim() || "შპს",
      bankIban: input.bankIban?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      address: input.address?.trim() || null,
      ownerId,
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "customer.created",
    entityType: "customer",
    entityId: customer.id,
    detail: { name: customer.name },
  });

  return customer;
}

export async function updateCustomer(
  ctx: WorkspaceContext,
  id: string,
  input: Partial<{
    name: string;
    taxId: string | null;
    legalForm: string | null;
    bankIban: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    ownerId: string | null;
  }>,
) {
  const existing = await prisma.customer.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!existing) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, existing.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  let ownerId = existing.ownerId;
  if (input.ownerId !== undefined) {
    if (!can(ctx.role, "crm.assign")) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }
    ownerId = input.ownerId
      ? await assertMemberOwner(ctx.company.id, input.ownerId)
      : null;
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      taxId: input.taxId === undefined ? undefined : input.taxId?.trim() || null,
      legalForm:
        input.legalForm === undefined
          ? undefined
          : input.legalForm?.trim() || "შპს",
      bankIban:
        input.bankIban === undefined
          ? undefined
          : input.bankIban?.trim() || null,
      email: input.email === undefined ? undefined : input.email?.trim() || null,
      phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
      website:
        input.website === undefined ? undefined : input.website?.trim() || null,
      address:
        input.address === undefined ? undefined : input.address?.trim() || null,
      ownerId,
    },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "customer.updated",
    entityType: "customer",
    entityId: customer.id,
  });

  return customer;
}

export async function archiveCustomer(ctx: WorkspaceContext, id: string) {
  const existing = await prisma.customer.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!existing) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, existing.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  const customer = await prisma.customer.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "customer.archived",
    entityType: "customer",
    entityId: id,
  });
  return customer;
}

export async function createContact(
  ctx: WorkspaceContext,
  input: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    title?: string;
    customerId?: string;
    ownerId?: string;
  },
) {
  if (input.customerId) {
    const cust = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId: ctx.company.id },
    });
    if (!cust) throw new AppError("Customer not found", "NOT_FOUND", 404);
  }

  const ownerId =
    can(ctx.role, "crm.assign") && input.ownerId
      ? await assertMemberOwner(ctx.company.id, input.ownerId)
      : ctx.user.id;

  return prisma.contact.create({
    data: {
      companyId: ctx.company.id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      title: input.title?.trim() || null,
      customerId: input.customerId || null,
      ownerId,
    },
  });
}

export async function addNote(
  ctx: WorkspaceContext,
  input: { body: string; customerId?: string; contactId?: string; dealId?: string },
) {
  if (!input.body.trim()) throw new AppError("Note is required", "VALIDATION");

  // Tenant-safe link checks
  if (input.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId: ctx.company.id },
    });
    if (!c) throw new AppError("Not found", "NOT_FOUND", 404);
  }
  if (input.dealId) {
    const d = await prisma.deal.findFirst({
      where: { id: input.dealId, companyId: ctx.company.id },
    });
    if (!d) throw new AppError("Not found", "NOT_FOUND", 404);
  }

  return prisma.note.create({
    data: {
      companyId: ctx.company.id,
      body: input.body.trim(),
      authorId: ctx.user.id,
      customerId: input.customerId || null,
      contactId: input.contactId || null,
      dealId: input.dealId || null,
    },
  });
}

export async function setCustomFieldValues(
  ctx: WorkspaceContext,
  customerId: string,
  values: Record<string, string | number | null>,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: ctx.company.id },
  });
  if (!customer) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!canAccessOwnedRecord(ctx.role, customer.ownerId, ctx.user.id)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const fields = await prisma.customFieldDefinition.findMany({
    where: { companyId: ctx.company.id, archivedAt: null },
  });

  for (const field of fields) {
    if (!(field.id in values) && !(field.key in values)) continue;
    const raw = values[field.id] ?? values[field.key];
    validateCustomValue(field.fieldType, field.options, field.required, raw);

    const data = mapCustomValue(field.fieldType, raw);
    await prisma.customFieldValue.upsert({
      where: { fieldId_customerId: { fieldId: field.id, customerId } },
      create: {
        companyId: ctx.company.id,
        fieldId: field.id,
        customerId,
        ...data,
      },
      update: data,
    });
  }
}

function validateCustomValue(
  type: CustomFieldType,
  optionsJson: string | null,
  required: boolean,
  raw: string | number | null | undefined,
) {
  if (raw === null || raw === undefined || raw === "") {
    if (required) throw new AppError("Required custom field missing", "VALIDATION");
    return;
  }
  if (type === "NUMBER" && Number.isNaN(Number(raw))) {
    throw new AppError("Invalid number", "VALIDATION");
  }
  if (type === "DATE") {
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) throw new AppError("Invalid date", "VALIDATION");
  }
  if (type === "SELECT") {
    const options: string[] = optionsJson ? JSON.parse(optionsJson) : [];
    if (!options.includes(String(raw))) {
      throw new AppError("Invalid select option", "VALIDATION");
    }
  }
}

function mapCustomValue(
  type: CustomFieldType,
  raw: string | number | null | undefined,
) {
  if (raw === null || raw === undefined || raw === "") {
    return { valueText: null, valueNumber: null, valueDate: null };
  }
  if (type === "NUMBER") {
    return { valueText: null, valueNumber: Number(raw), valueDate: null };
  }
  if (type === "DATE") {
    return { valueText: null, valueNumber: null, valueDate: new Date(String(raw)) };
  }
  return { valueText: String(raw), valueNumber: null, valueDate: null };
}

async function assertMemberOwner(companyId: string, userId: string) {
  const m = await prisma.membership.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!m) throw new AppError("Owner must be a workspace member", "VALIDATION");
  return userId;
}
