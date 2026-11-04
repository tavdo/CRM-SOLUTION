import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** @param {Record<string, string | undefined>} env */
export function isVercelSqliteDemo(env = process.env, vercelBuild = false) {
  return vercelBuild || Boolean(env.VERCEL) && (!env.DATABASE_URL || env.DATABASE_URL.startsWith("file:"));
}

/** Migrate a disposable deployment artifact; never migrate/reset the source or configured DB. */
export function prepareDemoDatabase({ root = process.cwd(), seedDemo = false } = {}) {
  const source = path.join(root, "prisma", "demo-seed.db");
  const artifact = path.join(root, "prisma", "deployment-demo.db");
  if (!existsSync(source)) throw new Error("The bundled demo baseline is missing");
  copyFileSync(source, artifact);
  const env = { ...process.env, DATABASE_URL: `file:${artifact.replaceAll("\\", "/")}`, SEED_DEMO_DATA: "false" };
  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], { cwd: root, env, stdio: "inherit" });
  if (seedDemo) {
    execFileSync(process.execPath, [require.resolve("tsx/cli"), path.join(fileURLToPath(new URL(".", import.meta.url)), "clean-legacy-demo.ts"), "--remove-alpha-beta"], { cwd: root, env, stdio: "inherit" });
  }
  return artifact;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (isVercelSqliteDemo(process.env, process.argv.includes("--vercel"))) {
    prepareDemoDatabase({ seedDemo: process.env.SEED_DEMO_DATA !== "false" });
    console.log("[prepare-demo-db] Migrated deployment artifact ready; source databases unchanged.");
  } else {
    console.log("[prepare-demo-db] No Vercel SQLite demo artifact needed.");
  }
}
