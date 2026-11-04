import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isVercelSqliteDemo, prepareDemoDatabase } from "../scripts/prepare-demo-db.mjs";
import { resolveDatabaseUrl } from "../src/lib/database-url";

const roots: string[] = [];
function temporaryRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "crm-deploy-test-"));
  roots.push(root);
  mkdirSync(path.join(root, "prisma"));
  mkdirSync(path.join(root, "runtime"));
  return root;
}
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
afterAll(async () => {
  for (const root of roots) {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("crm-deploy-test-")) throw new Error("Unsafe test cleanup path");
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

describe("Vercel SQLite deployment artifact", () => {
  it("only prepares Vercel file-database demos", () => {
    expect(isVercelSqliteDemo({})).toBe(false);
    expect(isVercelSqliteDemo({}, true)).toBe(true);
    // The explicit demo build always packages its own fixture; it never migrates the configured database.
    expect(isVercelSqliteDemo({ DATABASE_URL: "postgresql://example.invalid/db" }, true)).toBe(true);
    expect(isVercelSqliteDemo({ VERCEL: "1", DATABASE_URL: "file:./demo-seed.db" })).toBe(true);
    expect(isVercelSqliteDemo({ VERCEL: "1", DATABASE_URL: "postgresql://example.invalid/db" })).toBe(false);
    expect(resolveDatabaseUrl({ env: { DATABASE_URL: "file:./existing.db" } })).toBe("file:./existing.db");
  });
  it("fails explicitly if the migrated artifact was omitted, without falling back to stale SQLite", () => {
    const root = temporaryRoot();
    copyFileSync("prisma/demo-seed.db", path.join(root, "prisma", "demo-seed.db"));
    expect(() => resolveDatabaseUrl({ root, env: { VERCEL: "1" }, temporaryDirectory: path.join(root, "runtime") })).toThrow("Migrated deployment demo database is missing");
  });
  it("copies the migrated artifact once and preserves subsequent runtime writes", () => {
    const root = temporaryRoot();
    const artifact = path.join(root, "prisma", "deployment-demo.db");
    writeFileSync(artifact, "migrated artifact");
    const options = { root, env: { VERCEL: "1" }, temporaryDirectory: path.join(root, "runtime") };
    writeFileSync(path.join(root, "runtime", "crm-demo-contractor-v1.db"), "retired demo identities");
    const url = resolveDatabaseUrl(options);
    const runtime = url.slice(5);
    expect(path.basename(runtime)).toBe("crm-workspace-v2.db");
    expect(readFileSync(runtime, "utf8")).toBe("migrated artifact");
    writeFileSync(runtime, "runtime changes");
    expect(resolveDatabaseUrl(options)).toBe(url);
    expect(readFileSync(runtime, "utf8")).toBe("runtime changes");
    expect(readFileSync(artifact, "utf8")).toBe("migrated artifact");
  });
  it("packages a clean three-account workspace without changing source or configured databases", async () => {
    const root = temporaryRoot();
    const source = path.join(root, "prisma", "demo-seed.db");
    copyFileSync("prisma/demo-seed.db", source);
    copyFileSync("prisma/schema.prisma", path.join(root, "prisma", "schema.prisma"));
    cpSync("prisma/migrations", path.join(root, "prisma", "migrations"), { recursive: true });
    const configured = path.join(root, "existing-customer.db");
    writeFileSync(configured, "existing configured database must remain untouched");
    const before = hash(source);
    const client = new PrismaClient({ datasourceUrl: `file:${source.replaceAll("\\", "/")}` });
    try {
      expect(await client.constructionProject.count()).toBe(0);
      expect(await client.user.count()).toBe(3);
    } finally { await client.$disconnect(); }
    vi.stubEnv("DATABASE_URL", `file:${configured.replaceAll("\\", "/")}`);
    let artifact: string;
    try { artifact = prepareDemoDatabase({ root, seedDemo: true }); }
    finally { vi.unstubAllEnvs(); }
    expect(hash(source)).toBe(before);
    expect(readFileSync(configured, "utf8")).toBe("existing configured database must remain untouched");
    const deployment = new PrismaClient({ datasourceUrl: `file:${artifact.replaceAll("\\", "/")}` });
    try {
      expect(await deployment.company.count()).toBe(1);
      expect((await deployment.user.findMany({ select: { email: true }, orderBy: { email: "asc" } })).map((user) => user.email)).toEqual(["admin@crm.local", "manager@crm.local", "user@crm.local"]);
      expect(await deployment.membership.count({ where: { role: "ADMIN" } })).toBe(1);
      expect(await deployment.membership.count({ where: { role: "MANAGER" } })).toBe(1);
      expect(await deployment.membership.count({ where: { role: "EMPLOYEE" } })).toBe(1);
      expect(await deployment.customer.count()).toBe(0);
      expect(await deployment.deal.count()).toBe(0);
      expect(await deployment.lead.count()).toBe(0);
      expect(await deployment.constructionProject.count()).toBe(0);
      expect(await deployment.task.findMany({ select: { projectId: true, phase: true } })).toEqual([]);
      expect(await deployment.invoice.findMany({ select: { projectId: true, acceptanceId: true, vatRateBps: true } })).toEqual([]);
      expect(await deployment.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
    } finally { await deployment.$disconnect(); }
  }, 60000);
});
