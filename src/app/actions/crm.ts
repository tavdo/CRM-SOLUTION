"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { requireWorkspace, requireCapability } from "@/lib/auth/workspace";
import { AppError, isAppError } from "@/lib/errors";
import * as customers from "@/lib/services/customers";
import * as deals from "@/lib/services/deals";
import * as tasks from "@/lib/services/tasks";
import * as members from "@/lib/services/members";
import * as leadsSvc from "@/lib/services/leads";
import * as productsSvc from "@/lib/services/products";
import * as invoicesSvc from "@/lib/services/invoices";
import { isSupportedAutomationAction } from "@/lib/providers";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { can, assertChatChannel } from "@/lib/permissions";
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
      taxId: s(formData, "taxId") || undefined,
      legalForm: s(formData, "legalForm") || "შპს",
      bankIban: s(formData, "bankIban") || undefined,
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
    taxId: s(formData, "taxId") || null,
    legalForm: s(formData, "legalForm") || "შპს",
    bankIban: s(formData, "bankIban") || null,
    email: s(formData, "email") || null,
    phone: s(formData, "phone") || null,
    website: s(formData, "website") || null,
    address: s(formData, "address") || null,
    ownerId: formData.has("ownerId") ? s(formData, "ownerId") || null : undefined,
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

export async function moveDealByIdAction(
  locale: string,
  dealId: string,
  stageId: string,
) {
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
    customerId: formData.has("customerId") ? s(formData, "customerId") || null : undefined,
    ownerId: formData.has("ownerId") ? s(formData, "ownerId") || null : undefined,
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

export async function moveTaskStageAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const boardStage = s(formData, "boardStage") || "TODO";
  const ctx = await requireWorkspace();
  await tasks.getTask(ctx, id);
  if (!["TODO", "IN_PROGRESS", "REVIEW", "DONE"].includes(boardStage)) {
    throw new AppError("Invalid task stage", "VALIDATION", 400);
  }
  const status = boardStage === "DONE" ? "DONE" : "OPEN";
  await prisma.task.update({
    where: { id },
    data: {
      boardStage,
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });
  revalidatePath(localePath(locale, "/tasks"));
}

export async function completeTaskAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireWorkspace();
  await tasks.completeTask(ctx, id);
  await prisma.task.update({ where: { id }, data: { boardStage: "DONE" } });
  revalidatePath(localePath(locale, "/tasks"));
  revalidatePath(localePath(locale, `/tasks/${id}`));
}

export async function reopenTaskAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireWorkspace();
  await tasks.reopenTask(ctx, id);
  await prisma.task.update({ where: { id }, data: { boardStage: "TODO" } });
  revalidatePath(localePath(locale, "/tasks"));
  revalidatePath(localePath(locale, `/tasks/${id}`));
}

// —— Bitrix24 Leads Inbox & 1-Click Conversion ——
export async function createLeadAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  try {
    await leadsSvc.createLead(ctx, {
      title: s(formData, "title"),
      contactName: s(formData, "contactName"),
      companyName: s(formData, "companyName") || undefined,
      taxId: s(formData, "taxId") || undefined,
      phone: s(formData, "phone") || undefined,
      email: s(formData, "email") || undefined,
      source: s(formData, "source") || "FACEBOOK",
      amount: s(formData, "amount") || "0",
      notes: s(formData, "notes") || undefined,
      ownerId: s(formData, "ownerId") || undefined,
      forceDuplicate: s(formData, "forceDuplicate") === "1",
    });
  } catch (err) {
    if (isRedirect(err)) throw err;
    if (isAppError(err) && err.code === "DUPLICATE") {
      redirect(
        localePath(
          locale,
          `/leads?error=${encodeURIComponent(err.message)}`,
        ),
      );
    }
    throw err;
  }
  revalidatePath(localePath(locale, "/leads"));
}

export async function updateLeadStatusAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const leadId = s(formData, "leadId");
  const status = s(formData, "status");
  const ctx = await requireWorkspace();
  await leadsSvc.updateLeadStatus(ctx, leadId, status);
  revalidatePath(localePath(locale, "/leads"));
}

export async function assignLeadOwnerAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  await leadsSvc.assignLeadOwner(ctx, s(formData, "leadId"), s(formData, "ownerId"));
  revalidatePath(localePath(locale, "/leads"));
}

export async function convertLeadAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const leadId = s(formData, "leadId");
  const ctx = await requireWorkspace();
  const { deal } = await leadsSvc.convertLead(ctx, leadId);
  redirect(localePath(locale, `/deals/${deal.id}`));
}

// —— Products & Georgian Invoices / Quotes (დღგ 18%, ს/კ, BOG/TBC IBAN, RS.ge) ——
export async function createProductAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  await productsSvc.createProduct(ctx, {
    sku: s(formData, "sku") || undefined,
    name: s(formData, "name"),
    description: s(formData, "description") || undefined,
    unit: s(formData, "unit") || "ცალი",
    price: s(formData, "price") || "0",
  });
  revalidatePath(localePath(locale, "/products"));
  revalidatePath(localePath(locale, "/invoices"));
}

export async function toggleProductActiveAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const isActive = s(formData, "isActive") === "1";
  await productsSvc.setProductActive(ctx, s(formData, "id"), isActive);
  revalidatePath(localePath(locale, "/products"));
}

export async function createInvoiceAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const inv = await invoicesSvc.createInvoice(ctx, {
    customerId: s(formData, "customerId"),
    dealId: s(formData, "dealId") || null,
    productId: s(formData, "productId") || null,
    asQuote: s(formData, "asQuote") === "1",
    description: s(formData, "description") || undefined,
    quantity: Number(s(formData, "quantity") || "1"),
    unit: s(formData, "unit") || undefined,
    unitPrice: s(formData, "unitPrice") || "0",
    includeVat: s(formData, "includeVat") !== "false",
    rsGeWaybillRef: s(formData, "rsGeWaybillRef") || null,
    notes: s(formData, "notes") || undefined,
  });
  revalidatePath(localePath(locale, "/invoices"));
  redirect(localePath(locale, `/invoices/${inv.id}`));
}

export async function convertQuoteToInvoiceAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireWorkspace();
  await invoicesSvc.convertQuoteToInvoice(ctx, id);
  revalidatePath(localePath(locale, "/invoices"));
  revalidatePath(localePath(locale, `/invoices/${id}`));
  redirect(localePath(locale, `/invoices/${id}`));
}

export async function updateInvoiceStatusAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const status = s(formData, "status") || "PAID";
  const ctx = await requireWorkspace();
  await invoicesSvc.updateInvoiceStatus(ctx, id, status);
  revalidatePath(localePath(locale, "/invoices"));
  revalidatePath(localePath(locale, `/invoices/${id}`));
}

// —— Company Feed & Team Chat ——
export async function createFeedPostAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const title = s(formData, "title");
  const body = s(formData, "body");
  if (!title || !body) return;
  await prisma.feedPost.create({
    data: {
      companyId: ctx.company.id,
      authorId: ctx.user.id,
      title,
      body,
      category: s(formData, "category") || "ANNOUNCEMENT",
      pinned: s(formData, "pinned") === "on",
    },
  });
  revalidatePath(localePath(locale, "/feed"));
}

export async function sendChatMessageAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const body = s(formData, "body");
  const channel = s(formData, "channel") || "general";
  assertChatChannel(ctx.role, channel);
  if (!body) return;
  await prisma.chatMessage.create({
    data: {
      companyId: ctx.company.id,
      authorId: ctx.user.id,
      channel,
      body,
    },
  });
  revalidatePath(localePath(locale, "/feed"));
}

// —— HR, Worktime Clock-In/Out & Leave Requests ——
export async function toggleWorkClockAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const activeLog = await prisma.workLog.findFirst({
    where: {
      companyId: ctx.company.id,
      userId: ctx.user.id,
      status: "WORKING",
      clockOutAt: null,
    },
    orderBy: { clockInAt: "desc" },
  });

  if (activeLog) {
    await prisma.workLog.update({
      where: { id: activeLog.id },
      data: { status: "COMPLETED", clockOutAt: new Date() },
    });
  } else {
    await prisma.workLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        status: "WORKING",
        clockInAt: new Date(),
        note: s(formData, "note") || "Tbilisi Office / Remote",
      },
    });
  }
  revalidatePath(localePath(locale, "/hr"));
  revalidatePath(localePath(locale, "/dashboard"));
}

export async function createDepartmentAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("crm.all");
  await prisma.department.create({
    data: {
      companyId: ctx.company.id,
      name: s(formData, "name"),
      headName: s(formData, "headName") || null,
      memberCount: Math.max(1, Number(s(formData, "memberCount") || "1")),
    },
  });
  revalidatePath(localePath(locale, "/hr"));
}

export async function createLeaveRequestAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireWorkspace();
  const startDate = s(formData, "startDate")
    ? new Date(s(formData, "startDate"))
    : new Date();
  const endDate = s(formData, "endDate")
    ? new Date(s(formData, "endDate"))
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await prisma.leaveRequest.create({
    data: {
      companyId: ctx.company.id,
      userId: ctx.user.id,
      leaveType: s(formData, "leaveType") || "VACATION",
      startDate,
      endDate,
      reason: s(formData, "reason") || null,
      status: "PENDING",
    },
  });
  revalidatePath(localePath(locale, "/hr"));
}

export async function updateLeaveStatusAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const status = s(formData, "status") || "APPROVED";
  const ctx = await requireCapability("crm.all");
  const leave = await prisma.leaveRequest.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!leave) throw new AppError("Not found", "NOT_FOUND", 404);
  await prisma.leaveRequest.update({
    where: { id },
    data: { status },
  });
  revalidatePath(localePath(locale, "/hr"));
}

export async function createAutomationRuleAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const ctx = await requireCapability("company.automations");
  const actionType = s(formData, "actionType") || "CREATE_TASK";
  if (!isSupportedAutomationAction(actionType)) {
    throw new AppError("Unsupported automation action", "BAD_REQUEST", 400);
  }
  const triggerStageId = s(formData, "triggerStageId");
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: triggerStageId, companyId: ctx.company.id, archivedAt: null },
  });
  if (!stage) throw new AppError("Stage not found", "NOT_FOUND", 404);
  await prisma.automationRule.create({
    data: {
      companyId: ctx.company.id,
      name: s(formData, "name"),
      triggerStageId,
      actionType,
      actionDetail: s(formData, "actionDetail"),
      isActive: true,
    },
  });
  revalidatePath(localePath(locale, "/automations"));
  revalidatePath(localePath(locale, "/deals"));
}

export async function toggleAutomationRuleAction(formData: FormData) {
  const locale = s(formData, "locale") || "en";
  const id = s(formData, "id");
  const ctx = await requireCapability("company.automations");
  const rule = await prisma.automationRule.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!rule) throw new AppError("Not found", "NOT_FOUND", 404);
  if (!rule.isActive && !isSupportedAutomationAction(rule.actionType)) {
    throw new AppError("Unsupported automation action", "BAD_REQUEST", 400);
  }
  await prisma.automationRule.update({
    where: { id },
    data: { isActive: !rule.isActive },
  });
  revalidatePath(localePath(locale, "/automations"));
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
      taxId: s(formData, "taxId") || null,
      legalForm: s(formData, "legalForm") || "შპს",
      isVatPayer: s(formData, "isVatPayer") !== "false",
      bogIban: s(formData, "bogIban") || null,
      tbcIban: s(formData, "tbcIban") || null,
      address: s(formData, "address") || null,
      phone: s(formData, "phone") || null,
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
      options:
        fieldType === "SELECT"
          ? JSON.stringify(
              options
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            )
          : null,
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
