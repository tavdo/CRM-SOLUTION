import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const url = new URL(process.env.DIRECT_URL || "");
  if (!/^postgres/.test(url.protocol) || url.searchParams.get("schema") !== "crm") throw new Error("A private crm migration connection is required");
  const file = process.env.CRM_LIVE_ENV_FILE || path.resolve(".env.live.local");
  let text = readFileSync(file, "utf8");
  const admin = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    const roles = await admin.$queryRawUnsafe<{ rolname: string }[]>("SELECT rolname FROM pg_roles WHERE rolname = 'crm_backup'");
    if (roles.length) {
      if (!process.env.BACKUP_DATABASE_URL) throw new Error("Backup role already exists; existing credentials will not be overwritten");
    } else {
      const password = randomBytes(32).toString("hex");
      await admin.$transaction(async tx => {
        await tx.$executeRawUnsafe(`CREATE ROLE crm_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD '${password}'`);
        await tx.$executeRawUnsafe("ALTER ROLE crm_backup SET default_transaction_read_only = on");
        await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA "crm" TO crm_backup');
        await tx.$executeRawUnsafe('GRANT SELECT ON ALL TABLES IN SCHEMA "crm" TO crm_backup');
        await tx.$executeRawUnsafe('GRANT SELECT ON ALL SEQUENCES IN SCHEMA "crm" TO crm_backup');
        await tx.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA "crm" GRANT SELECT ON TABLES TO crm_backup');
        await tx.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA "crm" GRANT SELECT ON SEQUENCES TO crm_backup');
      });
      const oldUser = decodeURIComponent(url.username); const dot = oldUser.indexOf(".");
      url.username = dot >= 0 ? `crm_backup${oldUser.slice(dot)}` : "crm_backup";
      url.password = password;
      process.env.BACKUP_DATABASE_URL = url.toString();
      const entry = `BACKUP_DATABASE_URL=${JSON.stringify(url.toString())}`;
      text = /^BACKUP_DATABASE_URL=/m.test(text) ? text.replace(/^BACKUP_DATABASE_URL=.*$/m, entry) : `${text}\n${entry}\n`;
      writeFileSync(file, text, { mode: 0o600 });
    }
    const backup = new PrismaClient({ datasourceUrl: process.env.BACKUP_DATABASE_URL });
    try {
      await backup.user.count();
      const [access] = await backup.$queryRawUnsafe<{ read_only: string; can_write: boolean; can_create: boolean }[]>("SELECT current_setting('default_transaction_read_only') AS read_only, has_table_privilege(current_user, 'crm.\"User\"', 'INSERT') AS can_write, has_schema_privilege(current_user, 'crm', 'CREATE') AS can_create");
      if (!access || access.read_only !== "on" || access.can_write || access.can_create) throw new Error("Backup role must be read-only");
    } finally { await backup.$disconnect(); }
    console.log("Read-only backup role configured and verified. Credentials were not printed.");
  } finally { await admin.$disconnect(); }
}
void main().catch(() => { console.error("Backup-role setup failed; check migration privileges and local settings"); process.exitCode = 1; });
