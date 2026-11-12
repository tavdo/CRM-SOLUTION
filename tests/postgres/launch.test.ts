import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceContext } from "../../src/lib/auth/workspace";
vi.mock("../../src/lib/auth/session", () => ({ createSession: vi.fn(), setActiveWorkspace: vi.fn() }));
vi.mock("../../src/lib/email", () => ({ sendMail: vi.fn(), mailConfiguration: vi.fn() }));
import { prisma } from "../../src/lib/db";
import { registerCompany } from "../../src/lib/services/onboarding";
import { createInboundLead, convertLead } from "../../src/lib/services/leads";
import { createProject } from "../../src/lib/construction/core";
import { projectAccess } from "../../src/lib/construction/access";
import { enforceRateLimit } from "../../src/lib/rate-limit";

let ctx: WorkspaceContext;
beforeAll(() => { if (!process.env.CRM_POSTGRES_TEST || !/^postgres/.test(process.env.DATABASE_URL || "")) throw new Error("Run through the isolated PostgreSQL verification script"); });
afterAll(async () => { await prisma.$disconnect(); });
afterEach(() => vi.unstubAllEnvs());
describe("PostgreSQL launch workflows on an isolated database", () => {
  it("registers a Georgian workspace without adding demo accounts", async () => {
    const result = await registerCompany({ companyName: "სატესტო კომპანია", adminName: "ადმინისტრატორი", email: "pg-owner@example.test", password: "Postgres-Test123!", locale: "ka" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    const company = await prisma.company.findUniqueOrThrow({ where: { id: result.companyId } });
    const membership = await prisma.membership.findUniqueOrThrow({ where: { companyId_userId: { companyId: company.id, userId: user.id } } });
    ctx = { user, company, membership, role: "ADMIN", subscription: null };
    expect(company.isVatPayer).toBe(false);
    expect(await prisma.pipelineStage.count({ where: { companyId: company.id } })).toBe(6);
    expect(await prisma.user.count({ where: { email: { endsWith: "@crm.local" } } })).toBe(0);
  });
  it("captures and converts a lead, creates a project and preserves tenant isolation", async () => {
    const lead = await createInboundLead({ companySlug: ctx.company.slug, contactName: "გიორგი", phone: "+995555123456" });
    const converted = await convertLead(ctx, lead.leadId);
    expect(converted.customer.companyId).toBe(ctx.company.id);
    const project = await createProject(ctx, { name: "ტესტი", number: "PG-1", customerId: converted.customer.id, address: "თბილისი", workType: "სამუშაო", managerId: ctx.user.id });
    expect((await projectAccess(ctx, project.id)).id).toBe(project.id);
    const other = await prisma.company.create({ data: { name: "Other", slug: "pg-other" } });
    await expect(projectAccess({ ...ctx, company: other }, project.id)).rejects.toMatchObject({ status: 404 });
  });
  it("enforces shared limits atomically under concurrent PostgreSQL requests", async () => {
    const result = await Promise.allSettled(Array.from({ length: 12 }, () => enforceRateLimit("pg", "account", 3, 60000)));
    expect(result.filter(row => row.status === "fulfilled")).toHaveLength(3);
    expect(result.filter(row => row.status === "rejected")).toHaveLength(9);
  });
  it("persists a separate unverified account without verification tokens in database registration mode", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "preview");
    vi.stubEnv("REGISTRATION_MODE", "database");
    const account = await registerCompany({ companyName: "Early access", adminName: "New admin", email: "pg-new@example.test", password: "Postgres-Test123!", locale: "en" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(await prisma.emailVerifyToken.count({ where: { userId: user.id } })).toBe(0);
    expect(account.companyId).not.toBe(ctx.company.id);
    expect(await prisma.membership.count({ where: { userId: user.id } })).toBe(1);
  });
});
