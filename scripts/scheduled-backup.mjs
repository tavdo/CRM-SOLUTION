import { readFile, writeFile, readdir, mkdir, appendFile, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.resolve(process.env.BACKUP_DIRECTORY || path.join(homedir(), "Documents", "CRMsolution2026-Backups"));
await mkdir(directory, { recursive: true });
const statusFile = path.join(directory, "backup-status.json");
let previous = {};
try { previous = JSON.parse(await readFile(statusFile, "utf8")); } catch { /* First run. */ }
const now = new Date();
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const archive = path.join(directory, `crm-daily-${day}.crmbak`);
async function status(values) { await writeFile(statusFile, JSON.stringify({ ...previous, lastAttempt: now.toISOString(), ...values }, null, 2)); }
try {
  if (!process.env.BACKUP_DATABASE_URL) throw new Error("Read-only backup connection is not configured");
  if (existsSync(archive)) { console.log("Today's completed backup already exists."); process.exit(0); }
  const candidates = [process.env.PG_DUMP_PATH, ...["18", "17", "16"].map(version => `C:/Program Files/PostgreSQL/${version}/bin/pg_dump.exe`)];
  const pgDump = candidates.find(candidate => candidate && existsSync(candidate)) || "pg_dump";
  const child = spawnSync(process.execPath, [path.join(root, "scripts/backup.mjs"), "create", "--output", archive],
    { cwd: root, env: { ...process.env, DATABASE_URL: process.env.BACKUP_DATABASE_URL, DIRECT_URL: process.env.BACKUP_DATABASE_URL, PG_DUMP_PATH: pgDump },
      encoding: "utf8", timeout: 15 * 60 * 1000 });
  if (child.status !== 0) throw new Error("Encrypted backup did not complete");
  const size = (await stat(archive)).size;
  await status({ success: true, lastSuccess: new Date().toISOString(), archive: path.basename(archive), bytes: size });
  const managed = (await readdir(directory)).filter(name => /^crm-daily-\d{4}-\d{2}-\d{2}\.crmbak$/.test(name)).sort().reverse();
  // Retain the newest seven completed archives; never remove unrelated files.
  for (const name of managed.slice(7)) {
    const target = path.resolve(directory, name);
    if (path.dirname(target) !== directory) throw new Error("Unsafe retention target");
    await unlink(target);
  }
  await appendFile(path.join(directory, "backup.log"), `${new Date().toISOString()} backup completed (${size} bytes)\n`);
  console.log(`Daily encrypted backup completed: ${archive}`);
} catch (error) {
  await status({ success: false, error: error instanceof Error ? error.message : "Backup failed" });
  await appendFile(path.join(directory, "backup.log"), `${new Date().toISOString()} backup failed; inspect backup-status.json\n`);
  console.error("Daily backup failed; inspect the local status file. Credentials were not logged.");
  process.exitCode = 1;
}
