import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const postgres = /^postgres(ql)?:/.test(process.env.DATABASE_URL || "");
const schema = postgres ? "prisma/postgresql/schema.prisma" : "prisma/schema.prisma";
if (["live", "preview"].includes(process.env.DEPLOYMENT_MODE || "") && !postgres) throw new Error("Live deployment requires PostgreSQL");
if (postgres && !process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DATABASE_URL;
const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), ...args, "--schema", schema],
  { cwd: root, env: process.env, stdio: "inherit" });
if (result.error) throw new Error("Unable to execute Prisma");
process.exit(result.status ?? 1);
