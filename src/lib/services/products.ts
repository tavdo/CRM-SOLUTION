import { prisma } from "../db";
import { AppError } from "../errors";
import { can } from "../permissions";
import { toMinor } from "../money";
import { writeAudit } from "../audit";
import type { WorkspaceContext } from "../auth/workspace";

export async function listProducts(ctx: WorkspaceContext, activeOnly = false) {
  return prisma.product.findMany({
    where: {
      companyId: ctx.company.id,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createProduct(
  ctx: WorkspaceContext,
  input: {
    name: string;
    sku?: string;
    description?: string;
    unit?: string;
    price?: string | number;
    vatIncluded?: boolean;
  },
) {
  if (!can(ctx.role, "crm.create")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  const product = await prisma.product.create({
    data: {
      companyId: ctx.company.id,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      description: input.description?.trim() || null,
      unit: input.unit || "ცალი",
      priceMinor: toMinor(input.price ?? 0),
      currency: ctx.company.currency,
      vatIncluded: input.vatIncluded !== false,
      isActive: true,
    },
  });
  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
  });
  return product;
}

export async function setProductActive(
  ctx: WorkspaceContext,
  productId: string,
  isActive: boolean,
) {
  if (!can(ctx.role, "crm.all") && !can(ctx.role, "crm.create")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId: ctx.company.id },
  });
  if (!product) throw new AppError("Not found", "NOT_FOUND", 404);
  return prisma.product.update({ where: { id: productId }, data: { isActive } });
}
