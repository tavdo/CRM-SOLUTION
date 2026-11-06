import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const staging = mkdtempSync(path.join(tmpdir(), "crm-pg-verify-"));
const windowsBin = "C:/Program Files/PostgreSQL/18/bin";
const binary = name => process.env.PG_BIN ? path.join(process.env.PG_BIN, name + (process.platform === "win32" ? ".exe" : ""))
  : process.platform === "win32" && existsSync(windowsBin) ? path.join(windowsBin, name + ".exe") : name;
function run(command, args, env, quiet = false) {
  const startsServer = path.basename(command).startsWith("pg_ctl") && args.includes("start");
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8", stdio: startsServer ? "ignore" : quiet ? "pipe" : "inherit", timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(`PostgreSQL verification step failed: ${path.basename(command)} ${args[0]}${quiet ? `\n${result.stderr || ""}` : ""}`);
  return result.stdout;
}
const env = { ...process.env, NODE_ENV: "test", DEPLOYMENT_MODE: "test", SEED_DEMO_DATA: "false", SESSION_SECRET: randomBytes(48).toString("base64url"), CRM_POSTGRES_TEST: "true", BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("base64"), FILE_STORAGE: "local", INBOX_STORAGE: "local", BACKUP_LOCAL_STORAGE_PATH: path.join(staging, "test-media"), PG_DUMP_PATH: binary("pg_dump") };
let started = false; let status = 0;
try {
  if (process.env.TEST_POSTGRES_URL) {
    const target = new URL(process.env.TEST_POSTGRES_URL);
    if (!["localhost", "127.0.0.1", "postgres"].includes(target.hostname) || !target.pathname.includes("crm_test")) throw new Error("Only an explicitly named local crm_test database is accepted");
    env.DATABASE_URL = target.toString();
  } else {
    const port = await new Promise(resolve => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const p = server.address().port; server.close(() => resolve(p)); }); });
    run(binary("initdb"), ["-D", path.join(staging, "data"), "-U", "crm_test", "-A", "trust", "--no-locale", "--encoding=UTF8"], env, true);
    run(binary("pg_ctl"), ["-D", path.join(staging, "data"), "-l", path.join(staging, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"], env, true); started = true;
    run(binary("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "crm_test", "crm_test"], env, true);
    env.DATABASE_URL = `postgresql://crm_test@127.0.0.1:${port}/crm_test?schema=crm&sslmode=disable`;
  }
  env.DIRECT_URL = env.DATABASE_URL;
  run(process.execPath, ["scripts/prisma-command.mjs", "generate"], env);
  run(process.execPath, ["scripts/prisma-command.mjs", "migrate", "deploy"], env);
  run(process.execPath, [path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs"), "run", "--config", "vitest.postgres.config.mts"], env);
  const runtimeFile = path.join(staging, "runtime.env");
  writeFileSync(runtimeFile, `DATABASE_URL=${JSON.stringify(env.DATABASE_URL)}\n`);
  run(process.execPath, ["--import", "tsx", "scripts/provision-runtime.ts"], { ...env, CRM_LIVE_ENV_FILE: runtimeFile });
  const archive = path.join(staging, "postgres.crmbak"); const restored = path.join(staging, "restored");
  run(process.execPath, ["scripts/backup.mjs", "create", "--output", archive], env);
  run(process.execPath, ["scripts/backup.mjs", "restore", "--input", archive, "--to-dir", restored], env);
  const manifest = JSON.parse(readFileSync(path.join(restored, "manifest.json"), "utf8"));
  if (manifest.database !== "postgresql") throw new Error("Wrong backup database type");
  const url = new URL(env.DATABASE_URL);
  run(binary("createdb"), ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "crm_test_restore"], { ...env, PGPASSWORD: decodeURIComponent(url.password) }, true);
  const pgEnv = { ...env, PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get("sslmode") || "require" };
  run(binary("pg_restore"), ["--no-owner", "--no-privileges", "--exit-on-error", "-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", "crm_test_restore", path.join(restored, "database.dump")], pgEnv, true);
  const count = run(binary("psql"), ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", "crm_test_restore", "-tAc", 'SELECT count(*) FROM crm."ConstructionProject"'], pgEnv, true);
  if (count.trim() !== "1") throw new Error("Restored project count is incorrect");
  console.log("PASS PostgreSQL migration, CRM isolation, concurrent limits and encrypted backup/database restore.");
} catch (error) { console.error(error.message); status = 1; }
finally {
  if (started && existsSync(path.join(staging, "data/postmaster.pid"))) {
    try { run(binary("pg_ctl"), ["-D", path.join(staging, "data"), "-m", "fast", "-w", "stop"], env, true); }
    catch { console.error("Unable to stop the isolated test server; inspect its retained directory"); status = 1; }
  }
  // Restore the local SQLite client so normal development/tests keep working.
  const local = { ...process.env, DATABASE_URL: "file:./dev.db", DEPLOYMENT_MODE: "test" };
  try { run(process.execPath, ["scripts/prisma-command.mjs", "generate"], local); } catch { status = 1; }
}
console.log(`Isolated verification artifacts retained at ${staging}; no user database was reset.`);
process.exitCode = status;
