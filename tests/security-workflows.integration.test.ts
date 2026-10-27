import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import type { WorkspaceContext } from "../src/lib/auth/workspace";

const fixture = vi.hoisted(() => ({
  file: `${process.cwd().replaceAll("\\", "/")}/prisma/security-test-${process.pid}-${Date.now()}.db`,
  ctx: undefined as WorkspaceContext | undefined,
}));
vi.mock("../src/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: `file:${fixture.file}` }) };
});
vi.mock("../src/lib/auth/workspace", async () => {
  const { assertCan } = await import("../src/lib/permissions");
  return {
    requireWorkspace: async () => fixture.ctx!,
    requireCapability: async (capability: Parameters<typeof assertCan>[1]) => {
      assertCan(fixture.ctx!.role, capability);
      return fixture.ctx!;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../src/lib/auth/session", () => ({ createSession: vi.fn(), setActiveWorkspace: vi.fn() }));
vi.mock("../src/lib/email", () => ({ sendMail: vi.fn() }));

import { prisma } from "../src/lib/db";
import { getCustomer, addNote, createContact } from "../src/lib/services/customers";
import { createDeal, getDeal, listDeals, moveDealStage, updateDeal } from "../src/lib/services/deals";
import { getTask, listTasks, createTask } from "../src/lib/services/tasks";
import { getInvoice, listInvoices, createInvoice, updateInvoiceStatus, convertQuoteToInvoice } from "../src/lib/services/invoices";
import { findDuplicateLead, listLeads, createLead, convertLead } from "../src/lib/services/leads";
import { registerCompany } from "../src/lib/services/onboarding";
import { getDashboard } from "../src/lib/services/dashboard";
import { createAutomationRuleAction, toggleAutomationRuleAction, updateCustomerAction, moveTaskStageAction } from "../src/app/actions/crm";
import { exportWorkspace } from "../src/lib/services/export";
import { GET as downloadExport } from "../src/app/api/workspace/export/route";
import { NextRequest } from "next/server";

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

describe("authorized CRM workflows with an isolated migrated database", () => {
  let employee: WorkspaceContext;
  let admin: WorkspaceContext;

  beforeAll(async () => {
    for (const migration of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort()) {
      const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8");
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
    const plan = await prisma.plan.create({ data: { code: "test", name: "Test", maxDeals: 100, maxCustomers: 100 } });
    const company = await prisma.company.create({ data: { id: "a", name: "ქართული კომპანია", slug: "test-a" } });
    await prisma.subscription.create({ data: { companyId: "a", planId: plan.id, status: "ACTIVE" } });
    await prisma.company.create({ data: { id: "b", name: "Other tenant", slug: "test-b" } });
    const user = await prisma.user.create({ data: { id: "me", name: "თანამშრომელი", email: "me@test.local", passwordHash: "excluded-hash" } });
    await prisma.user.create({ data: { id: "other", name: "Other", email: "other@test.local", passwordHash: "excluded-hash" } });
    const membership = await prisma.membership.create({ data: { companyId: "a", userId: "me", role: "EMPLOYEE" } });
    employee = { company, user, membership, role: "EMPLOYEE", subscription: null };
    admin = { ...employee, role: "ADMIN" };
    fixture.ctx = employee;
    for (const [id, companyId, ownerId] of [["own", "a", "me"], ["restricted", "a", "other"], ["foreign", "b", "other"]]) {
      await prisma.customer.create({ data: { id, companyId, ownerId, name: id } });
      await prisma.pipelineStage.create({ data: { id: `stage-${id}`, companyId, name: id, sortOrder: 0 } });
      await prisma.contact.create({ data: { id: `contact-${id}`, companyId, ownerId, customerId: "own", firstName: id, lastName: id } });
      await prisma.deal.create({ data: { id: `deal-${id}`, companyId, ownerId, customerId: "own", stageId: `stage-${id}`, title: id } });
      await prisma.task.create({ data: { id: `task-${id}`, companyId, ownerId, creatorId: "me", customerId: "own", dealId: "deal-own", title: id } });
      await prisma.invoice.create({ data: { id: `invoice-${id}`, companyId, customerId: id, invoiceNumber: id } });
      await prisma.lead.create({ data: { id: `lead-${id}`, companyId, ownerId, title: id, contactName: id, email: `${id}@test.local`, source: "WEBSITE" } });
      await prisma.note.create({ data: { companyId, authorId: "me", customerId: "own", dealId: `deal-${id}`, body: id } });
    }
    // Legacy links or later owner changes must not bypass nested authorization.
    await prisma.task.update({ where: { id: "task-own" }, data: { customerId: "restricted", dealId: "deal-restricted", dueAt: new Date(0) } });
    await prisma.deal.update({ where: { id: "deal-own" }, data: { customerId: "restricted", contactId: "contact-restricted" } });
    await prisma.invoice.update({ where: { id: "invoice-own" }, data: { dealId: "deal-restricted" } });
  }, 40000);

  afterAll(async () => {
    await prisma.$disconnect();
    for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(fixture.file + suffix, { force: true });
  });

  it("blocks direct identifiers from other owners and tenants", async () => {
    for (const id of ["restricted", "foreign"]) {
      await expect(getCustomer(employee, id)).rejects.toMatchObject({ status: 404 });
      await expect(getDeal(employee, `deal-${id}`)).rejects.toMatchObject({ status: 404 });
      await expect(getTask(employee, `task-${id}`)).rejects.toMatchObject({ status: 404 });
      await expect(getInvoice(employee, `invoice-${id}`)).rejects.toMatchObject({ status: 404 });
    }
    expect((await getCustomer(admin, "restricted")).id).toBe("restricted");
  });

  it("filters nested records and redacts restricted to-one relations", async () => {
    const customer = await getCustomer(employee, "own");
    expect(customer.contacts.map((c) => c.id)).toEqual(["contact-own"]);
    expect(customer.deals).toEqual([]);
    expect(customer.notes.map((n) => n.body)).toEqual(["own"]);
    const deal = await getDeal(employee, "deal-own");
    expect(deal.customer).toBeNull();
    expect(deal.contact).toBeNull();
    expect(deal.tasks).toEqual([]);
    expect((await listDeals(employee))[0].customer).toBeNull();
    expect((await getTask(employee, "task-own")).deal).toBeNull();
    expect((await listTasks(employee))[0].customer).toBeNull();
    expect((await getDashboard(employee)).overdueTasks[0].deal).toBeNull();
    expect((await getInvoice(employee, "invoice-own")).deal).toBeNull();
  });

  it("scopes contact-center leads, invoice lists, and duplicate lookups", async () => {
    expect((await listLeads(employee, { source: "WEBSITE", take: 8 })).map((l) => l.id)).toEqual(["lead-own"]);
    expect((await listInvoices(employee)).map((i) => i.id)).toEqual(["invoice-own"]);
    expect(await findDuplicateLead(employee, { email: "restricted@test.local" })).toBeNull();
  });

  it("rejects forged links before creating or updating records", async () => {
    for (const customerId of ["restricted", "foreign"]) {
      await expect(createTask(employee, { title: "forged", customerId })).rejects.toMatchObject({ status: 404 });
      await expect(createDeal(employee, { title: "forged", customerId })).rejects.toMatchObject({ status: 404 });
      await expect(updateDeal(employee, "deal-own", { customerId })).rejects.toMatchObject({ status: 404 });
      await expect(createContact(employee, { firstName: "forged", lastName: "forged", customerId })).rejects.toMatchObject({ status: 404 });
      await expect(addNote(employee, { body: "forged", customerId })).rejects.toMatchObject({ status: 404 });
      await expect(createInvoice(employee, { customerId })).rejects.toBeDefined();
    }
    await expect(addNote(employee, { body: "forged", contactId: "contact-foreign" })).rejects.toMatchObject({ status: 404 });
    await expect(createTask(employee, { title: "forged", dealId: "deal-restricted" })).rejects.toMatchObject({ status: 404 });
  });

  it("preserves an employee's ordinary edit and invoice workflow without claiming delivery", async () => {
    fixture.ctx = employee;
    await updateCustomerAction(form({ id: "own", name: "სახელი", locale: "ka" }));
    expect((await getCustomer(employee, "own")).name).toBe("სახელი");
    const invoice = await createInvoice(employee, { customerId: "own", unitPrice: "10.01", quantity: 3 });
    expect(invoice.status).toBe("DRAFT");
    expect(invoice.subtotalMinor).toBe(3003);
    expect(invoice.totalMinor).toBe(3544);
    await updateInvoiceStatus(employee, invoice.id, "PAID");
    expect((await getInvoice(employee, invoice.id)).status).toBe("PAID");
  });

  it("enforces automation management, stage tenancy, and unavailable actions on forged requests", async () => {
    const request = form({ name: "Follow up", triggerStageId: "stage-own", actionType: "CREATE_TASK", actionDetail: "Call" });
    for (const role of ["EMPLOYEE", "MANAGER"] as const) {
      fixture.ctx = { ...employee, role };
      await expect(createAutomationRuleAction(request)).rejects.toMatchObject({ status: 403 });
    }
    fixture.ctx = admin;
    await expect(createAutomationRuleAction(form({ ...Object.fromEntries(request), triggerStageId: "stage-foreign" } as Record<string, string>))).rejects.toMatchObject({ status: 404 });
    await expect(createAutomationRuleAction(form({ ...Object.fromEntries(request), actionType: "SEND_SMS" } as Record<string, string>))).rejects.toMatchObject({ status: 400 });
    await createAutomationRuleAction(request);
    const sms = await prisma.automationRule.create({ data: { companyId: "a", name: "Legacy SMS", triggerStageId: "stage-own", actionType: "SEND_SMS", actionDetail: "Hello", isActive: false } });
    await expect(toggleAutomationRuleAction(form({ id: sms.id }))).rejects.toMatchObject({ status: 400 });
    await prisma.automationRule.update({ where: { id: sms.id }, data: { isActive: true } });
    await moveDealStage(employee, "deal-own", "stage-own");
    const skipped = await prisma.auditEvent.findFirst({ where: { action: "automation.skipped_unsupported" } });
    expect(JSON.parse(skipped!.detail!)).toMatchObject({ delivered: false });
    expect(await prisma.auditEvent.count({ where: { action: "automation.sms_sent" } })).toBe(0);
    await expect(moveDealStage(employee, "deal-own", "stage-foreign")).rejects.toMatchObject({ status: 404 });
  });

  it("blocks forged task-board changes", async () => {
    fixture.ctx = employee;
    for (const id of ["task-restricted", "task-foreign"]) {
      await expect(moveTaskStageAction(form({ id, boardStage: "DONE" }))).rejects.toMatchObject({ status: 404 });
    }
    await expect(moveTaskStageAction(form({ id: "task-own", boardStage: "INVALID" }))).rejects.toMatchObject({ status: 400 });
    await moveTaskStageAction(form({ id: "task-own", boardStage: "DONE" }));
    expect((await getTask(employee, "task-own")).status).toBe("DONE");
  });

  it("denies employee and manager exports at both the route and service", async () => {
    for (const role of ["EMPLOYEE", "MANAGER"] as const) {
      fixture.ctx = { ...employee, role };
      await expect(exportWorkspace(fixture.ctx, "json")).rejects.toMatchObject({ status: 403 });
      expect((await downloadExport(new NextRequest("http://localhost/api/workspace/export"))).status).toBe(403);
    }
  });

  it("exports paginated, tenant-scoped JSON with stable links and no authentication data", async () => {
    await prisma.customer.createMany({ data: Array.from({ length: 205 }, (_, i) => ({
      id: `page-${String(i).padStart(3, "0")}`, companyId: "a", name: `ქართული ${i}`, ownerId: "me",
    })) });
    await prisma.user.create({ data: { id: "beta-only", name: "Beta private", email: "beta-private@test.local", passwordHash: "EXCLUDED_PASSWORD" } });
    await prisma.membership.create({ data: { companyId: "b", userId: "beta-only", role: "ADMIN" } });
    await prisma.passwordResetToken.create({ data: { userId: "me", tokenHash: "EXCLUDED_RESET_TOKEN", expiresAt: new Date(Date.now() + 60000) } });
    fixture.ctx = admin;
    const response = await downloadExport(new NextRequest("http://localhost/api/workspace/export?format=json"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const raw = await response.text();
    const data = JSON.parse(raw);
    expect(data.schemaVersion).toBe(1);
    expect(data.customers).toHaveLength(207);
    expect(raw).toContain("ქართული");
    expect(raw).not.toMatch(/EXCLUDED_|excluded-hash|passwordHash|tokenHash|beta-private/);
    for (const [entity, rows] of Object.entries(data)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if ("companyId" in row) expect(row.companyId, entity).toBe("a");
        expect(row.id).not.toContain("foreign");
      }
    }
    for (const invoice of data.invoices) {
      expect(data.customers.some((customer: { id: string }) => customer.id === invoice.customerId)).toBe(true);
    }
    for (const item of data.invoiceItems) {
      expect(data.invoices.some((invoice: { id: string }) => invoice.id === item.invoiceId)).toBe(true);
    }
    const audit = await prisma.auditEvent.findMany({ where: { entityType: "workspace_export" } });
    expect(audit.some((event) => event.action === "export.completed")).toBe(true);
    expect(audit.every((event) => event.detail === '{"schemaVersion":1,"format":"json"}')).toBe(true);
  });

  it("escapes formula content in the customers-only UTF-8 CSV", async () => {
    await prisma.customer.update({ where: { id: "own" }, data: { name: '=HYPERLINK("malicious")', address: "ქართული მისამართი" } });
    const csv = await new Response(await exportWorkspace(admin, "csv")).text();
    expect(csv).toContain('"\'=HYPERLINK(""malicious"")"');
    expect(csv).toContain("ქართული მისამართი");
    expect(csv).not.toContain("foreign");
  });

  it("audits cancelled and failed exports without exporting personal data into logs", async () => {
    const cancelled = await exportWorkspace(admin, "json");
    await cancelled.cancel();
    expect(await prisma.auditEvent.count({ where: { action: "export.cancelled" } })).toBe(1);
    const failure = vi.spyOn(prisma.customer, "findMany").mockRejectedValueOnce(new Error("synthetic failure"));
    try {
      await expect(new Response(await exportWorkspace(admin, "json")).text()).rejects.toThrow("synthetic failure");
    } finally { failure.mockRestore(); }
    expect(await prisma.auditEvent.count({ where: { action: "export.failed" } })).toBe(1);
  });

  it("completes the Georgian service workflow from registration to a draft invoice", async () => {
    const registered = await registerCompany({ companyName: "ქართული გუნდი", adminName: "ადმინისტრატორი", email: "workflow@test.local", password: "Synthetic-test-only-123!", locale: "ka" });
    const company = await prisma.company.findUniqueOrThrow({ where: { id: registered.companyId } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: registered.userId } });
    const membership = await prisma.membership.findUniqueOrThrow({ where: { companyId_userId: { companyId: company.id, userId: user.id } } });
    const ctx: WorkspaceContext = { company, user, membership, role: membership.role, subscription: null };
    const lead = await createLead(ctx, { title: "საწყობის დანერგვა", contactName: "გიორგი მაგალითი", companyName: "ქართული კომპანია", phone: "599 12 34 56", amount: "19.99" });
    expect((await findDuplicateLead(ctx, { phone: "00995 599 123 456" }))?.id).toBe(lead.id);
    const { customer, deal } = await convertLead(ctx, lead.id);
    const task = await createTask(ctx, { title: "დაუკავშირდით კლიენტს", customerId: customer.id, dealId: deal.id, dueAt: "2026-10-28T00:30" });
    expect(task.dueAt!.toISOString()).toBe("2026-10-27T20:30:00.000Z");
    const quote = await createInvoice(ctx, { customerId: customer.id, dealId: deal.id, asQuote: true, description: "მომსახურება", unitPrice: "19.99", quantity: 3 });
    expect(quote.status).toBe("QUOTE");
    expect(quote.totalMinor).toBe(7076);
    expect((await convertQuoteToInvoice(ctx, quote.id)).status).toBe("DRAFT");
    expect((await getCustomer(ctx, customer.id)).name).toBe("ქართული კომპანია");
    for (const quantity of [1.5, -1, NaN, Infinity]) {
      await expect(createInvoice(ctx, { customerId: customer.id, quantity, unitPrice: "10" })).rejects.toMatchObject({ status: 400 });
    }
    await expect(createInvoice(ctx, { customerId: customer.id, unitPrice: "999999999999" })).rejects.toMatchObject({ status: 400 });
  });
});
