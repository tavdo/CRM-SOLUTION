import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceContext } from "../../src/lib/auth/workspace";

const mocks = vi.hoisted(() => ({ user: vi.fn(), member: vi.fn(), aggregate: vi.fn() }));
vi.mock("../../src/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("../../src/lib/db", () => ({ prisma: { membership: { findUnique: mocks.member }, inboxConversation: { aggregate: mocks.aggregate } } }));
import { inboxChangeVersion } from "../../src/lib/inbox/changes";

const ctx = { user: { id: "manager-1" }, company: { id: "company-a" }, role: "MANAGER" } as WorkspaceContext;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue(ctx.user);
  mocks.member.mockResolvedValue({ role: "MANAGER" });
  mocks.aggregate.mockResolvedValue({ _count: { id: 4 }, _max: { updatedAt: new Date(1000) } });
});
describe("lightweight inbox change detection", () => {
  it("uses a scoped aggregate and retains session/membership checks", async () => {
    expect(await inboxChangeVersion(ctx)).toBe("MANAGER:4:1000");
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(mocks.member).toHaveBeenCalledWith({ where: { companyId_userId: { companyId: "company-a", userId: "manager-1" } }, select: { role: true } });
    expect(mocks.aggregate.mock.calls[0][0].where).toMatchObject({ companyId: "company-a", assignedUserId: "manager-1" });
  });
  it("uses already-authorized context for the initial snapshot", async () => {
    await inboxChangeVersion(ctx, false);
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.member).not.toHaveBeenCalled();
  });
  it("closes access after session expiry, membership removal or employee demotion", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(inboxChangeVersion(ctx)).rejects.toMatchObject({ status: 401 });
    mocks.user.mockResolvedValue(ctx.user); mocks.member.mockResolvedValue(null);
    await expect(inboxChangeVersion(ctx)).rejects.toMatchObject({ status: 401 });
    mocks.member.mockResolvedValue({ role: "EMPLOYEE" });
    await expect(inboxChangeVersion(ctx)).rejects.toMatchObject({ status: 403 });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
  it("detects deletions and permission changes as well as message updates", async () => {
    const first = await inboxChangeVersion(ctx);
    mocks.aggregate.mockResolvedValue({ _count: { id: 3 }, _max: { updatedAt: new Date(1000) } });
    expect(await inboxChangeVersion(ctx)).not.toBe(first);
    mocks.member.mockResolvedValue({ role: "ADMIN" });
    expect(await inboxChangeVersion(ctx)).toBe("ADMIN:3:1000");
    expect(mocks.aggregate.mock.calls.at(-1)?.[0].where).not.toHaveProperty("assignedUserId");
  });
});
