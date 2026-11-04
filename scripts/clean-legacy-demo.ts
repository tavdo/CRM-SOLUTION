import { PrismaClient } from "@prisma/client";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { removeLegacyDemoWorkspaces } from "../src/lib/legacy-demo-cleanup";
import { ensureWorkspaceAccounts } from "../src/lib/workspace-seed";

async function main() {
  if (!process.argv.includes("--remove-alpha-beta")) throw new Error("Explicit --remove-alpha-beta is required");
  if (!process.env.DATABASE_URL?.startsWith("file:")) throw new Error("An explicit SQLite DATABASE_URL is required");
  const db = new PrismaClient();
  try {
    await ensureWorkspaceAccounts(db);
    const result = await removeLegacyDemoWorkspaces(db);
    const storageRoot = path.resolve(process.cwd(), "storage", "construction");
    for (const key of result.documentStorageKeys) {
      if (!/^[\da-f-]+\.(png|jpg|webp|pdf)$/.test(key)) throw new Error("Unexpected document storage key");
      const file = path.resolve(storageRoot, key);
      if (path.dirname(file) !== storageRoot) throw new Error("Document is outside the project storage directory");
      try { await unlink(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    // Rebuild the file so deleted sample values do not remain in unused database pages.
    await db.$executeRawUnsafe("VACUUM");
    console.log(JSON.stringify({ workspacesRemoved: result.workspacesRemoved, accountsRemoved: result.accountsRemoved, documentFilesRemoved: result.documentStorageKeys.length }));
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Cleanup failed"); process.exitCode = 1; });
