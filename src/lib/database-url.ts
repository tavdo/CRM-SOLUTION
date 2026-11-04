import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

export function resolveDatabaseUrl({ env = process.env, root = process.cwd(), temporaryDirectory = "/tmp" }: {
  env?: Record<string, string | undefined>;
  root?: string;
  temporaryDirectory?: string;
} = {}): string {
  const configured = env.DATABASE_URL;
  if (env.VERCEL && (!configured || configured.startsWith("file:"))) {
    const runtime = path.join(temporaryDirectory, "crm-workspace-v2.db");
    if (!existsSync(runtime)) {
      const artifact = path.join(root, "prisma", "deployment-demo.db");
      if (!existsSync(artifact)) {
        const error = new Error("Migrated deployment demo database is missing. Run the Vercel build preparation step.");
        Object.assign(error, { code: "DEPLOYMENT_DB_MISSING" });
        throw error;
      }
      copyFileSync(artifact, runtime);
    }
    return `file:${runtime.replaceAll("\\", "/")}`;
  }
  return configured || "file:./demo-seed.db";
}
