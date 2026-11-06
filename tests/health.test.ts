import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rateLimitBucket: { findFirst: vi.fn() }, constructionProject: { count: vi.fn() }, inboxConversation: { count: vi.fn() }, task: { findFirst: vi.fn() }, invoice: { findFirst: vi.fn() } }));
vi.mock("../src/lib/db", () => ({ prisma: db }));
vi.mock("../src/lib/db-init", () => ({ ensureDbInitialized: vi.fn() }));
import { GET } from "../src/app/api/health/route";
afterEach(() => vi.resetAllMocks());

describe("production schema health", () => {
  it("reports healthy when project tables and linked CRM columns can be queried", async () => {
    db.constructionProject.count.mockResolvedValue(0);
    db.task.findFirst.mockResolvedValue(null);
    db.invoice.findFirst.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ok");
  });
  it("reports 503 for a pre-construction database without exposing database errors", async () => {
    db.constructionProject.count.mockRejectedValue(Object.assign(new Error("ConstructionProject table missing: private database path"), { code: "P2021" }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", db: false, reason: "schema_not_ready" });
  });
  it("also detects missing project columns on legacy invoices", async () => {
    db.constructionProject.count.mockResolvedValue(0);
    db.invoice.findFirst.mockRejectedValue(new Error("Missing acceptanceId"));
    expect((await GET()).status).toBe(503);
  });
  it("reports schema-not-ready when inbox migrations are missing", async () => {
    db.inboxConversation.count.mockRejectedValue(Object.assign(new Error("private schema information"), { code: "P2021" }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", db: false, reason: "schema_not_ready" });
  });
  it("reports a missing deployment artifact without exposing filesystem paths", async () => {
    db.constructionProject.count.mockRejectedValue(Object.assign(new Error("private path"), { code: "DEPLOYMENT_DB_MISSING" }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", db: false, reason: "deployment_artifact_missing" });
  });
});
