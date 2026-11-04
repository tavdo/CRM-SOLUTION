import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ constructionProject: { count: vi.fn() }, task: { findFirst: vi.fn() }, invoice: { findFirst: vi.fn() } }));
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
    db.constructionProject.count.mockRejectedValue(new Error("ConstructionProject table missing: private database path"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", db: false });
  });
  it("also detects missing project columns on legacy invoices", async () => {
    db.constructionProject.count.mockResolvedValue(0);
    db.invoice.findFirst.mockRejectedValue(new Error("Missing acceptanceId"));
    expect((await GET()).status).toBe(503);
  });
});
