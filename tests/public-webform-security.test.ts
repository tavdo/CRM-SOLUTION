import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "../src/lib/errors";
const fixture = vi.hoisted(() => ({ create: vi.fn(), limit: vi.fn() }));
vi.mock("../src/lib/db-init", () => ({ ensureDbInitialized: vi.fn() }));
vi.mock("../src/lib/services/leads", () => ({ createInboundLead: fixture.create }));
vi.mock("../src/lib/rate-limit", () => ({ clientIdentity: () => "trusted-client", enforceRateLimit: fixture.limit }));
import { POST } from "../src/app/api/inbound/webform/route";
beforeEach(() => { vi.resetAllMocks(); fixture.create.mockResolvedValue({ leadId: "lead", duplicate: false }); });
const request = (body: string, type = "application/json") => new NextRequest("https://crm.example.test/api/inbound/webform", { method: "POST", headers: { "content-type": type }, body });
describe("public lead form boundary", () => {
  it("returns a retry interval and performs no writes after a shared limit is exceeded", async () => {
    fixture.limit.mockRejectedValue(new AppError("Try later", "RATE_LIMIT", 429, { retryAfter: 42 }));
    const response = await POST(request('{"companySlug":"one","contactName":"User"}'));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("42"); expect(fixture.create).not.toHaveBeenCalled();
  });
  it("rejects an oversized body even without a content-length header", async () => {
    const response = await POST(request(JSON.stringify({ companySlug: "one", contactName: "User", message: "x".repeat(40000) })));
    expect(response.status).toBe(413); expect(fixture.create).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON and malformed email without creating a lead", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request('{"companySlug":"one","contactName":"User","email":"wrong"}'))).status).toBe(400);
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("keeps URL-encoded customer website forms working", async () => {
    const response = await POST(request("companySlug=one&contactName=User&email=user%40example.test", "application/x-www-form-urlencoded"));
    expect(response.status).toBe(200); expect(fixture.create).toHaveBeenCalledWith(expect.objectContaining({ companySlug: "one", contactName: "User", email: "user@example.test" }));
  });
});
