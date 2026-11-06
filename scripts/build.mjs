import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { isVercelSqliteDemo, prepareDemoDatabase } from "./prepare-demo-db.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
const live = ["live", "preview"].includes(process.env.DEPLOYMENT_MODE || "");
if ((process.env.VERCEL || process.env.NETLIFY) && !["live", "preview", "demo"].includes(process.env.DEPLOYMENT_MODE || "")) {
  throw new Error("Set DEPLOYMENT_MODE=live, restricted preview, or explicit demo before deploying");
}
if (live) run(["--import", "tsx", "scripts/production-check.ts"]);
run(["scripts/sync-postgres-schema.mjs", "--check"]);
run(["scripts/prisma-command.mjs", "generate"]);
if (isVercelSqliteDemo() && !live) {
  if (process.env.DEPLOYMENT_MODE !== "demo") throw new Error("Temporary SQLite hosting requires explicit demo mode");
  prepareDemoDatabase({ seedDemo: true });
}
run([require.resolve("next/dist/bin/next"), "build"]);
