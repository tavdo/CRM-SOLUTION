import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;

  // On Vercel serverless runtime, copy the bundled pre-seeded SQLite DB into writable /tmp
  if (process.env.VERCEL && (!envUrl || envUrl.startsWith("file:"))) {
    const tmpDbPath = "/tmp/crm-demo.db";
    try {
      if (!fs.existsSync(tmpDbPath)) {
        const candidates = [
          path.join(process.cwd(), "prisma", "demo-seed.db"),
          path.join(process.cwd(), "prisma", "dev.db"),
        ];
        for (const src of candidates) {
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, tmpDbPath);
            break;
          }
        }
      }
      return `file:${tmpDbPath}`;
    } catch {
      // Fallback during static build phase
    }
  }

  return envUrl || "file:./demo-seed.db";
}

const resolvedUrl = resolveDatabaseUrl();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolvedUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolvedUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
