import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  client: { $queryRawUnsafe: vi.fn() }, seed: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({ prisma: fixture.client }));
vi.mock("../src/lib/workspace-seed", () => ({ ensureWorkspaceAccounts: fixture.seed }));
const state = globalThis as unknown as { crmDbInitialization?: unknown };
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  delete state.crmDbInitialization;
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("SEED_DEMO_DATA", "true");
  fixture.client.$queryRawUnsafe.mockResolvedValue([{ name: "Lead" }]);
  fixture.seed.mockResolvedValue(undefined);
});
afterEach(() => { delete state.crmDbInitialization; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("development database bootstrap lifetime", () => {
  it("shares initialization across concurrent requests and reloaded route modules", async () => {
    const first = await import("../src/lib/db-init");
    await Promise.all([first.ensureDbInitialized(), first.ensureDbInitialized()]);
    vi.resetModules();
    await (await import("../src/lib/db-init")).ensureDbInitialized();
    expect(fixture.seed).toHaveBeenCalledOnce();
    expect(fixture.client.$queryRawUnsafe).toHaveBeenCalledOnce();
  });
  it("can retry after a failed bootstrap", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fixture.seed.mockRejectedValueOnce(new Error("temporarily unavailable"));
    const { ensureDbInitialized } = await import("../src/lib/db-init");
    await ensureDbInitialized(); await ensureDbInitialized();
    expect(fixture.seed).toHaveBeenCalledTimes(2);
  });
  it("does not initialize or seed production databases", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await (await import("../src/lib/db-init")).ensureDbInitialized();
    expect(fixture.seed).not.toHaveBeenCalled();
    expect(fixture.client.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
