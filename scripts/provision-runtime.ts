import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const runtimeUrl = new URL(process.env.DATABASE_URL || "");
  const directUrl = new URL(process.env.DIRECT_URL || "");
  if (!/^postgres/.test(directUrl.protocol) || directUrl.searchParams.get("schema") !== "crm") throw new Error("A PostgreSQL migration connection using the private crm schema is required");
  const file = process.env.CRM_LIVE_ENV_FILE || path.resolve(".env.live.local");
  let text = readFileSync(file, "utf8");
  const admin = new PrismaClient({ datasourceUrl: directUrl.toString() });
  try {
    const roles = await admin.$queryRawUnsafe<{ rolname: string }[]>("SELECT rolname FROM pg_roles WHERE rolname = 'crm_app'");
    if (roles.length) {
      if (!decodeURIComponent(runtimeUrl.username).startsWith("crm_app")) throw new Error("crm_app already exists; existing role credentials will not be overwritten");
      console.log("Runtime role already configured; credentials were preserved"); return;
    }
    const password = randomBytes(32).toString("hex");
    await admin.$transaction(async tx => {
      // The identifier is fixed and the only interpolated value is generated hex.
      await tx.$executeRawUnsafe(`CREATE ROLE crm_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD '${password}'`);
      await tx.$executeRawUnsafe('REVOKE ALL ON SCHEMA "crm" FROM PUBLIC');
      await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA "crm" TO crm_app');
      await tx.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "crm" TO crm_app');
      await tx.$executeRawUnsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "crm" TO crm_app');
      await tx.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA "crm" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app');
      await tx.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA "crm" GRANT USAGE, SELECT ON SEQUENCES TO crm_app');
    });
    const oldUser = decodeURIComponent(runtimeUrl.username); const dot = oldUser.indexOf(".");
    runtimeUrl.username = dot >= 0 ? `crm_app${oldUser.slice(dot)}` : "crm_app";
    runtimeUrl.password = password;
    text = text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${JSON.stringify(runtimeUrl.toString())}`);
    writeFileSync(file, text, { mode: 0o600 });
    const runtime = new PrismaClient({ datasourceUrl: runtimeUrl.toString() });
    try {
      await runtime.user.count();
      const [access] = await runtime.$queryRawUnsafe<{ can_create: boolean; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }[]>("SELECT has_schema_privilege(current_user, 'crm', 'CREATE') AS can_create, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user");
      if (!access || access.can_create || access.rolsuper || access.rolcreatedb || access.rolcreaterole) throw new Error("Runtime role has excessive privileges");
    } finally { await runtime.$disconnect(); }
    console.log("Runtime role configured and connection verified; migration credentials remain separate and no passwords were printed");
  } finally { await admin.$disconnect(); }
}
void main().catch(error => {
  const code = (error as { code?: string }).code;
  console.error(`Runtime provisioning could not complete${code ? ` (${code})` : ""}; verify migration privileges and the private environment file`);
  process.exitCode = 1;
});
