import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { ensureWorkspaceAccounts, PRIMARY_WORKSPACE_ID, WORKSPACE_ACCOUNTS } from "../src/lib/workspace-seed";
import { removeLegacyDemoWorkspaces } from "../src/lib/legacy-demo-cleanup";

const roots: string[] = [];
let db: PrismaClient;
let baseline: string;
beforeAll(async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "crm-workspace-test-"));
  roots.push(root);
  baseline = path.join(root, "baseline.db");
  // Migration PRAGMAs must stay on one connection. Separate raw Prisma queries
  // can switch pooled connections, leaving foreign keys enabled during rebuilds.
  const database = new DatabaseSync(baseline);
  try {
    for (const migration of readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort()) {
      database.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    }
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally { database.close(); }
}, 30000);
beforeEach(async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "crm-workspace-test-"));
  roots.push(root);
  const database = path.join(root, "test.db");
  await copyFile(baseline, database);
  db = new PrismaClient({ datasourceUrl: `file:${database.replaceAll("\\", "/")}` });
}, 30000);
afterEach(async () => { await db.$disconnect(); });
afterAll(async () => {
  for (const root of roots) {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("crm-workspace-test-")) throw new Error("Unsafe test cleanup path");
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

async function legacyFixtures() {
  for (const prefix of ["alpha", "beta"]) {
    const companyId = `company_${prefix}`;
    await db.company.create({ data: { id: companyId, slug: `demo-${prefix}`, name: `Legacy ${prefix}` } });
    for (const [role, name] of [["ADMIN", "admin"], ["MANAGER", "manager"], ["EMPLOYEE", "employee"]] as const) {
      const userId = `${prefix}_${name}`;
      await db.user.create({ data: { id: userId, email: `${name}@demo-${prefix}.local`, name, passwordHash: "legacy-hash" } });
      await db.membership.create({ data: { companyId, userId, role } });
      await db.session.create({ data: { userId, tokenHash: `${userId}-session`, expiresAt: new Date("2030-01-01") } });
    }
    const admin = `${prefix}_admin`;
    const customer = await db.customer.create({ data: { id: `${prefix}-customer`, companyId, ownerId: admin, name: "Sample client" } });
    const stage = await db.pipelineStage.create({ data: { companyId, name: "Sample stage", sortOrder: 0 } });
    const deal = await db.deal.create({ data: { companyId, stageId: stage.id, customerId: customer.id, ownerId: admin, title: "Sample deal" } });
    const project = await db.constructionProject.create({ data: { companyId, customerId: customer.id, dealId: deal.id, number: "DEMO-1", name: "Sample site", address: "Sample address", workType: "Sample work", managerId: admin } });
    const task = await db.task.create({ data: { companyId, projectId: project.id, title: "Sample task", ownerId: `${prefix}_employee`, creatorId: admin } });
    const report = await db.siteReport.create({ data: { companyId, projectId: project.id, taskId: task.id, authorId: admin, date: new Date(), body: "Sample progress", operationKey: "report" } });
    await db.projectDocument.create({ data: { companyId, projectId: project.id, reportId: report.id, createdById: admin, name: "Sample photo", category: "PHOTO", storageKey: `${prefix === "alpha" ? "a" : "b"}0000000-0000-0000-0000-000000000000.png`, mimeType: "image/png", size: 8 } });
    const acceptance = await db.workAcceptance.create({ data: { companyId, projectId: project.id, number: "ACT-1", operationKey: "acceptance", netMinor: 100, vatMinor: 0, totalMinor: 100 } });
    await db.acceptanceLine.create({ data: { companyId, projectId: project.id, acceptanceId: acceptance.id, description: "Sample", quantity: "1", unit: "m", unitMinor: 100, totalMinor: 100 } });
    await db.invoice.create({ data: { companyId, customerId: customer.id, projectId: project.id, acceptanceId: acceptance.id, invoiceNumber: "INV-1", items: { create: { description: "Sample", quantity: 1, unitMinor: 100, totalMinor: 100 } } } });
    const product = await db.product.create({ data: { id: `${prefix}-product`, companyId, name: "Sample material" } });
    const partner = await db.tradePartner.create({ data: { companyId, name: "Sample vendor", kind: "SUPPLIER" } });
    const request = await db.materialRequest.create({ data: { companyId, projectId: project.id, productId: product.id, quantity: "1", requestedById: admin, operationKey: "request" } });
    await db.supplyQuote.create({ data: { companyId, projectId: project.id, requestId: request.id, partnerId: partner.id, unitMinor: 100 } });
    const order = await db.purchaseOrder.create({ data: { companyId, projectId: project.id, requestId: request.id, partnerId: partner.id, productId: product.id, quantity: "1", unitMinor: 100, totalMinor: 100 } });
    await db.stockMovement.create({ data: { companyId, projectId: project.id, productId: product.id, purchaseOrderId: order.id, quantity: "1", kind: "RECEIPT", operationKey: "receipt", createdById: admin } });
    const subcontract = await db.subcontract.create({ data: { companyId, projectId: project.id, partnerId: partner.id, title: "Sample", unit: "m", quantity: "1", unitMinor: 100, totalMinor: 100 } });
    await db.subcontractProgress.create({ data: { companyId, projectId: project.id, subcontractId: subcontract.id, quantity: "1", operationKey: "progress", confirmedById: admin, date: new Date() } });
    await db.projectPayment.create({ data: { companyId, projectId: project.id, subcontractId: subcontract.id, direction: "OUT", kind: "PAYMENT", amountMinor: 100, description: "Sample", date: new Date(), operationKey: "payment", recordedById: admin } });
  }
}

describe("clean workspace bootstrap and explicit legacy cleanup", () => {
  it("creates exactly three hashed role accounts and no sample CRM records", async () => {
    await ensureWorkspaceAccounts(db);
    expect(await db.company.count()).toBe(1);
    expect(await db.user.count()).toBe(3);
    expect((await db.membership.findMany()).map((membership) => membership.role).sort()).toEqual(["ADMIN", "EMPLOYEE", "MANAGER"]);
    for (const account of WORKSPACE_ACCOUNTS) {
      const user = await db.user.findUniqueOrThrow({ where: { email: account.email } });
      expect(await bcrypt.compare("Password123!", user.passwordHash)).toBe(true);
    }
    expect(await db.customer.count()).toBe(0);
    expect(await db.deal.count()).toBe(0);
    expect(await db.task.count()).toBe(0);
    expect(await db.lead.count()).toBe(0);
    expect(await db.invoice.count()).toBe(0);
    expect(await db.constructionProject.count()).toBe(0);
    expect(await db.product.count()).toBe(0);
    expect(await db.pipelineStage.count({ where: { companyId: PRIMARY_WORKSPACE_ID } })).toBe(6);
  });
  it("does not reset passwords, roles, branding, pipelines or CRM data on a later seed", async () => {
    await ensureWorkspaceAccounts(db);
    await db.user.update({ where: { id: "workspace_admin" }, data: { passwordHash: "changed-password-hash", name: "Changed name" } });
    await db.company.update({ where: { id: PRIMARY_WORKSPACE_ID }, data: { name: "Changed company" } });
    await db.membership.updateMany({ where: { userId: "workspace_user" }, data: { role: "MANAGER" } });
    await db.pipelineStage.updateMany({ where: { companyId: PRIMARY_WORKSPACE_ID }, data: { name: "Custom stage" } });
    await db.customer.create({ data: { companyId: PRIMARY_WORKSPACE_ID, name: "Real customer", ownerId: "workspace_admin" } });
    await ensureWorkspaceAccounts(db);
    expect((await db.user.findUniqueOrThrow({ where: { id: "workspace_admin" } })).passwordHash).toBe("changed-password-hash");
    expect((await db.company.findUniqueOrThrow({ where: { id: PRIMARY_WORKSPACE_ID } })).name).toBe("Changed company");
    expect((await db.membership.findFirstOrThrow({ where: { userId: "workspace_user" } })).role).toBe("MANAGER");
    expect(await db.pipelineStage.count({ where: { name: "Custom stage" } })).toBe(6);
    expect(await db.customer.count()).toBe(1);
    expect(await db.user.count()).toBe(3);
  });
  it("clears legacy CRM, contractor dependencies and sessions while preserving a non-demo workspace", async () => {
    await legacyFixtures();
    await db.company.create({ data: { id: "real", name: "Real workspace", slug: "real" } });
    await db.user.create({ data: { id: "real-user", email: "owner@example.test", name: "Owner", passwordHash: "private-hash" } });
    await db.membership.create({ data: { companyId: "real", userId: "real-user", role: "ADMIN" } });
    await db.customer.create({ data: { id: "real-customer", companyId: "real", ownerId: "real-user", name: "Real customer" } });
    const result = await removeLegacyDemoWorkspaces(db);
    expect(result).toMatchObject({ workspacesRemoved: 2, accountsRemoved: 6 });
    expect(result.documentStorageKeys).toHaveLength(2);
    expect(await db.company.count()).toBe(1);
    expect(await db.user.count()).toBe(1);
    expect(await db.customer.findMany({ select: { id: true } })).toEqual([{ id: "real-customer" }]);
    expect(await db.constructionProject.count()).toBe(0);
    expect(await db.invoice.count()).toBe(0);
    expect(await db.invoiceItem.count()).toBe(0);
    expect(await db.task.count()).toBe(0);
    expect(await db.stockMovement.count()).toBe(0);
    expect(await db.subcontract.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
    expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
    await ensureWorkspaceAccounts(db);
    expect(await removeLegacyDemoWorkspaces(db)).toMatchObject({ accountsRemoved: 0, workspacesRemoved: 0 });
    expect(await db.user.count()).toBe(4);
    expect(await db.customer.count()).toBe(1);
  });
  it("refuses to delete a legacy identity linked to a real workspace, without partial deletion", async () => {
    await legacyFixtures();
    await db.company.create({ data: { id: "real", name: "Real", slug: "real" } });
    await db.customer.create({ data: { companyId: "real", ownerId: "alpha_admin", name: "Real record" } });
    await expect(removeLegacyDemoWorkspaces(db)).rejects.toThrow("linked to a non-demo workspace");
    expect(await db.company.count()).toBe(3);
    expect(await db.user.count()).toBe(6);
    expect(await db.constructionProject.count()).toBe(2);
  });
  it("refuses to detach a real workspace's cross-tenant links during cleanup", async () => {
    await legacyFixtures();
    await db.company.create({ data: { id: "real", name: "Real", slug: "real" } });
    await db.user.create({ data: { id: "real-user", email: "owner@example.test", name: "Owner", passwordHash: "private-hash" } });
    await db.note.create({ data: { companyId: "real", authorId: "real-user", customerId: "alpha-customer", body: "Real note with legacy link" } });
    await expect(removeLegacyDemoWorkspaces(db)).rejects.toThrow("non-demo record links to demo data");
    expect(await db.user.count()).toBe(7);
    expect(await db.customer.findUnique({ where: { id: "alpha-customer" } })).not.toBeNull();
  });
  it("does not take over a registered account or a renamed non-demo workspace", async () => {
    await db.user.create({ data: { id: "existing-account", email: "admin@crm.local", name: "Existing", passwordHash: "preserved" } });
    await expect(ensureWorkspaceAccounts(db)).rejects.toThrow("already belongs to another account");
    expect(await db.company.count()).toBe(0);
    expect(await db.user.count()).toBe(1);
    await db.company.create({ data: { id: "company_alpha", slug: "real-workspace", name: "Real" } });
    await expect(removeLegacyDemoWorkspaces(db)).rejects.toThrow("non-demo workspace");
    expect(await db.company.count()).toBe(1);
  });
});
