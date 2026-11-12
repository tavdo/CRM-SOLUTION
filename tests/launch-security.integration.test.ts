import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, rmSync } from "node:fs";

const fixture = vi.hoisted(() => ({ file: `${process.cwd().replaceAll("\\", "/")}/prisma/launch-security-${process.pid}-${Date.now()}.db`,
  cookies: new Map<string, string>(), cookieWrites: 0 }));
vi.mock("../src/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: `file:${fixture.file}?connection_limit=1` }) };
});
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => fixture.cookies.has(name) ? { value: fixture.cookies.get(name)! } : undefined,
  set: (name: string, value: string) => { fixture.cookieWrites++; fixture.cookies.set(name, value); }, delete: (name: string) => fixture.cookies.delete(name) }) }));
vi.mock("../src/lib/db-init", () => ({ ensureDbInitialized: vi.fn() }));
import { prisma } from "../src/lib/db";
import { createSession, destroySession, getSessionUser } from "../src/lib/auth/session";
import { resetPassword } from "../src/lib/services/onboarding";
import { enforceRateLimit, clientIdentity } from "../src/lib/rate-limit";
import { hashToken, verifyPassword, hashPassword } from "../src/lib/crypto";

beforeAll(async () => {
  for (const name of readdirSync("prisma/migrations").filter(n => /^\d/.test(n)).sort()) {
    for (const sql of readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").split(";").map(s => s.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(sql);
  }
  await prisma.user.create({ data: { id: "session-user", email: "session@example.test", name: "Session", passwordHash: "unused" } });
});
beforeEach(() => { fixture.cookies.clear(); fixture.cookieWrites = 0; vi.stubEnv("SESSION_SECRET", "test-only-random-secret-that-is-at-least-32-characters"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await prisma.$disconnect(); for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(fixture.file + suffix, { force: true }); });

describe("authoritative session revocation", () => {
  it("rejects passwords beyond bcrypt's byte limit instead of silently truncating Unicode passwords", async () => {
    await expect(hashPassword("ა".repeat(25))).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
  });
  it("creates distinct tokens for simultaneous logins and authenticates a persisted token", async () => {
    const first = await createSession("session-user"); const second = await createSession("session-user");
    expect(first).not.toBe(second);
    expect(await getSessionUser()).toMatchObject({ id: "session-user" });
  });
  it("rejects replay after logout even while the signed JWT is unexpired", async () => {
    const token = await createSession("session-user"); await destroySession();
    fixture.cookies.set("crm_session", token);
    expect(await getSessionUser()).toBeNull();
  });
  it("invalidates every device after password reset and prevents token reuse", async () => {
    const first = await createSession("session-user"); const second = await createSession("session-user");
    await prisma.passwordResetToken.create({ data: { userId: "session-user", tokenHash: hashToken("reset-once"), expiresAt: new Date(Date.now() + 60000) } });
    await prisma.passwordResetToken.create({ data: { userId: "session-user", tokenHash: hashToken("older-reset"), expiresAt: new Date(Date.now() + 60000) } });
    await resetPassword("reset-once", "New-Password123!");
    for (const token of [first, second]) { fixture.cookies.set("crm_session", token); expect(await getSessionUser()).toBeNull(); }
    expect(await verifyPassword("New-Password123!", (await prisma.user.findUniqueOrThrow({ where: { id: "session-user" } })).passwordHash)).toBe(true);
    await expect(resetPassword("reset-once", "Other-Password123!")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    await expect(resetPassword("older-reset", "Other-Password123!")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
  it("does not issue a cookie when persisting the session fails", async () => {
    vi.spyOn(prisma.session, "create").mockRejectedValueOnce(new Error("offline"));
    await expect(createSession("session-user")).rejects.toThrow("offline"); expect(fixture.cookieWrites).toBe(0);
  });
  it("rejects expired database sessions", async () => {
    const token = await createSession("session-user");
    await prisma.session.update({ where: { tokenHash: hashToken(token) }, data: { expiresAt: new Date(0) } });
    expect(await getSessionUser()).toBeNull();
  });
  it("denies an existing valid session when a hosted preview excludes that account", async () => {
    await createSession("session-user");
    vi.stubEnv("DEPLOYMENT_MODE", "preview"); vi.stubEnv("PREVIEW_EMAILS", "another-owner@example.test");
    expect(await getSessionUser()).toBeNull();
    await expect(createSession("session-user")).rejects.toThrow("Session user is unavailable");
  });
});

describe("shared abuse limits", () => {
  it("allows only the configured number of concurrent attempts and stores no plaintext identity", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 15 }, () => enforceRateLimit("concurrent", "private-email@example.test", 5, 60000)));
    expect(attempts.filter(x => x.status === "fulfilled")).toHaveLength(5);
    const rejected = attempts.filter(x => x.status === "rejected");
    expect(rejected).toHaveLength(10);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "RATE_LIMIT", status: 429 });
    expect(JSON.stringify(await prisma.rateLimitBucket.findMany())).not.toContain("private-email");
    await expect(enforceRateLimit("other-action", "private-email@example.test", 5, 60000)).resolves.toBeUndefined();
  });
  it("ignores spoofable forwarding headers until a trusted single-IP header is configured", () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "");
    expect(clientIdentity(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("shared-unattributed-client");
    vi.stubEnv("TRUSTED_IP_HEADER", "x-real-ip");
    expect(clientIdentity(new Headers({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIdentity(new Headers({ "x-real-ip": "1.2.3.4, 5.6.7.8" }))).toBe("shared-unattributed-client");
  });
});
