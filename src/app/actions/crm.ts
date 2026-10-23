"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { requireWorkspace, requireCapability } from "@/lib/auth/workspace";
import { isAppError } from "@/lib/errors";
import * as customers from "@/lib/services/customers";
import * as deals from "@/lib/services/deals";
import * as tasks from "@/lib/services/tasks";
import * as members from "@/lib/services/members";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { slugify } from "@/lib/slug";

function s(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function localePath(locale: string, path: string) {
  return `/${locale}${path}`;
}

export async function createCustomerAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  try {
    const ctx = await requireWorkspace();
    const customer = await customers.createCustomer(ctx, {
      name: s(formData, "name"),
      email: s(formData, "email") || undefined,
      phone: s(formData, "phone") || undefined,
      website: s(formData, "website") || undefined,
      address: s(formData, "address") || undefined,
      ownerId: s(formData, "ownerId") || undefined,
    });
    redirect(localePath(locale, `/customers/${customer.id}`));
  } catch (err) {
    if (isRedirect(err)) throw err;
    throw err;
  }
}

export async function updateCustomerAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireWorkspace();
  await customers.updateCustomer(ctx, id, {
    name: s(formData, "name"),
    email: s(formData, "email") || null,
    phone: s(formData, "phone") || null,
    website: s(formData, "website") || null,
    address: s(formData, "address") || null,
    ownerId: s(formData, "ownerId") || null,
  });
  revalidatePath(localePath(locale, `/customers/${id}`));
}

export async function archiveCustomerAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireWorkspace();
  await customers.archiveCustomer(ctx, id);
  redirect(localePath(locale, "/customers"));
}

export async function addCustomerNoteAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const customerId = s(formData, "customerId");
  const ctx = await requireWorkspace();
  await customers.addNote(ctx, { body: s(formData, "body"), customerId });
  revalidatePath(localePath(locale, `/customers/${customerId}`));
}

export async function addContactAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const customerId = s(formData, "customerId");
  const ctx = await requireWorkspace();
  await customers.createContact(ctx, {
    firstName: s(formData, "firstName"),
    lastName: s(formData, "lastName"),
    email: s(formData, "email") || undefined,
    phone: s(formData, "phone") || undefined,
    title: s(formData, "title") || undefined,
    customerId,
  });
  revalidatePath(localePath(locale, `/customers/${customerId}`));
}

export async function createDealAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const deal = await deals.createDeal(ctx, {
    title: s(formData, "title"),
    customerId: s(formData, "customerId") || undefined,
    stageId: s(formData, "stageId") || undefined,
    ownerId: s(formData, "ownerId") || undefined,
    amount: s(formData, "amount") || 0,
    currency: s(formData, "currency") || undefined,
    expectedCloseAt: s(formData, "expectedCloseAt") || null,
  });
  redirect(localePath(locale, `/deals/${deal.id}`));
}

export async function moveDealAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const dealId = s(formData, "dealId");
  const stageId = s(formData, "stageId");
  const ctx = await requireWorkspace();
  await deals.moveDealStage(ctx, dealId, stageId);
  revalidatePath(localePath(locale, "/deals"));
  revalidatePath(localePath(locale, `/deals/${dealId}`));
}

export async function closeDealAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const dealId = s(formData, "dealId");
  const outcome = s(formData, "outcome") as "WON" | "LOST";
  const ctx = await requireWorkspace();
  await deals.closeDeal(ctx, dealId, outcome, s(formData, "lossReason") || undefined);
  revalidatePath(localePath(locale, `/deals/${dealId}`));
}

export async function updateDealAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const dealId = s(formData, "dealId");
  const ctx = await requireWorkspace();
  await deals.updateDeal(ctx, dealId, {
    title: s(formData, "title"),
    amount: s(formData, "amount"),
    currency: s(formData, "currency"),
    expectedCloseAt: s(formData, "expectedCloseAt") || null,
    customerId: s(formData, "customerId") || null,
    ownerId: s(formData, "ownerId") || null,
  });
  revalidatePath(localePath(locale, `/deals/${dealId}`));
}

export async function createTaskAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const task = await tasks.createTask(ctx, {
    title: s(formData, "title"),
    description: s(formData, "description") || undefined,
    dueAt: s(formData, "dueAt") || null,
    ownerId: s(formData, "ownerId") || undefined,
    customerId: s(formData, "customerId") || undefined,
    dealId: s(formData, "dealId") || undefined,
  });
  redirect(localePath(locale, `/tasks/${task.id}`));
}

export async function completeTaskAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireWorkspace();
  await tasks.completeTask(ctx, id);
  revalidatePath(localePath(locale, "/tasks"));
  revalidatePath(localePath(locale, `/tasks/${id}`));
}

export async function reopenTaskAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireWorkspace();
  await tasks.reopenTask(ctx, id);
  revalidatePath(localePath(locale, "/tasks"));
  revalidatePath(localePath(locale, `/tasks/${id}`));
}

export async function inviteMemberAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.members");
  await members.inviteMember(ctx, {
    email: s(formData, "email"),
    role: s(formData, "role") as Role,
  });
  revalidatePath(localePath(locale, "/settings"));
}

export async function removeMemberAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.members");
  await members.removeMember(ctx, s(formData, "membershipId"));
  revalidatePath(localePath(locale, "/settings"));
}

export async function updateMemberRoleAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.members");
  await members.updateMemberRole(
    ctx,
    s(formData, "membershipId"),
    s(formData, "role") as Role,
  );
  revalidatePath(localePath(locale, "/settings"));
}

export async function updateCompanyAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.settings");
  await prisma.company.update({
    where: { id: ctx.company.id },
    data: {
      name: s(formData, "name"),
      timezone: s(formData, "timezone") || "Asia/Tbilisi",
      defaultLocale: s(formData, "defaultLocale") || "ka",
      currency: s(formData, "currency") || "GEL",
    },
  });
  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "company.updated",
    entityType: "company",
    entityId: ctx.company.id,
  });
  revalidatePath(localePath(locale, "/settings"));
}

export async function addStageAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.pipeline");
  const max = await prisma.pipelineStage.aggregate({
    where: { companyId: ctx.company.id, archivedAt: null },
    _max: { sortOrder: true },
  });
  await prisma.pipelineStage.create({
    data: {
      companyId: ctx.company.id,
      name: s(formData, "name"),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(localePath(locale, "/settings"));
}

export async function deleteStageAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  await deals.deleteStage(ctx, s(formData, "stageId"), s(formData, "moveToStageId"));
  revalidatePath(localePath(locale, "/settings"));
  revalidatePath(localePath(locale, "/deals"));
}

export async function addCustomFieldAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.customFields");
  const name = s(formData, "name");
  const fieldType = s(formData, "fieldType") as "TEXT" | "NUMBER" | "DATE" | "SELECT";
  const options = s(formData, "options");
  const key = slugify(name).replace(/-/g, "_") || `field_${Date.now()}`;
  await prisma.customFieldDefinition.create({
    data: {
      companyId: ctx.company.id,
      name,
      key: `${key}_${Date.now().toString(36)}`,
      fieldType,
      options: fieldType === "SELECT" ? JSON.stringify(options.split(",").map((x) => x.trim()).filter(Boolean)) : null,
      required: s(formData, "required") === "on",
    },
  });
  revalidatePath(localePath(locale, "/settings"));
}

export async function archiveCustomFieldAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.customFields");
  const field = await prisma.customFieldDefinition.findFirst({
    where: { id: s(formData, "fieldId"), companyId: ctx.company.id },
  });
  if (!field) return;
  await prisma.customFieldDefinition.update({
    where: { id: field.id },
    data: { archivedAt: new Date() },
  });
  revalidatePath(localePath(locale, "/settings"));
}

export async function changePlanAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.billing");
  const planId = s(formData, "planId");
  const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan || !ctx.subscription) return;
  await prisma.subscription.update({
    where: { id: ctx.subscription.id },
    data: { planId: plan.id },
  });
  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "subscription.plan_changed",
    entityType: "subscription",
    entityId: ctx.subscription.id,
    detail: { planCode: plan.code },
  });
  revalidatePath(localePath(locale, "/settings"));
}

export async function saveCustomValuesAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const customerId = s(formData, "customerId");
  const ctx = await requireWorkspace();
  const fields = await prisma.customFieldDefinition.findMany({
    where: { companyId: ctx.company.id, archivedAt: null },
  });
  const values: Record<string, string> = {};
  for (const f of fields) {
    values[f.id] = s(formData, `field_${f.id}`);
  }
  await customers.setCustomFieldValues(ctx, customerId, values);
  revalidatePath(localePath(locale, `/customers/${customerId}`));
}

export async function getActionErrorMessage(err: unknown) {
  return isAppError(err) ? err.message : "Error";
}

export async function assertCanManage(capability: Parameters<typeof can>[1]) {
  const ctx = await requireWorkspace();
  return can(ctx.role, capability);
}

function isRedirect(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
