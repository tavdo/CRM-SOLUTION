import type { Prisma } from "@prisma/client";
import { can } from "./permissions";
import { AppError } from "./errors";
import { prisma } from "./db";
import type { WorkspaceContext } from "./auth/workspace";

/** Owner filter for records with ownerId. Empty for roles with crm.all. */
export function ownerScope(
  ctx: WorkspaceContext,
): { ownerId: string } | Record<string, never> {
  if (can(ctx.role, "crm.all")) return {};
  return { ownerId: ctx.user.id };
}

export function customerOwnerScope(
  ctx: WorkspaceContext,
): Prisma.InvoiceWhereInput {
  if (can(ctx.role, "crm.all")) return {};
  return { customer: recordScope(ctx) };
}

export function leadListWhere(
  ctx: WorkspaceContext,
  extra: Prisma.LeadWhereInput = {},
): Prisma.LeadWhereInput {
  return {
    AND: [{ companyId: ctx.company.id, ...ownerScope(ctx) }, extra],
  };
}

export function recordScope(ctx: WorkspaceContext) {
  return { companyId: ctx.company.id, ...ownerScope(ctx) };
}

export function noteScope(ctx: WorkspaceContext): Prisma.NoteWhereInput {
  const scope = recordScope(ctx);
  return {
    companyId: ctx.company.id,
    AND: [
      { OR: [{ customerId: null }, { customer: scope }] },
      { OR: [{ contactId: null }, { contact: scope }] },
      { OR: [{ dealId: null }, { deal: scope }] },
    ],
  };
}

export function visibleRelation<T extends { companyId: string; ownerId: string | null }>(ctx: WorkspaceContext, record: T | null): T | null {
  if (!record || record.companyId !== ctx.company.id) return null;
  return can(ctx.role, "crm.all") || record.ownerId === ctx.user.id ? record : null;
}

export async function assertLinkedAccess(ctx: WorkspaceContext, kind: "customer" | "contact" | "deal", id: string) {
  const where = { id, ...recordScope(ctx) };
  const record = kind === "customer" ? await prisma.customer.findFirst({ where })
    : kind === "contact" ? await prisma.contact.findFirst({ where })
      : await prisma.deal.findFirst({ where });
  if (!record) throw new AppError("Not found", "NOT_FOUND", 404);
}
