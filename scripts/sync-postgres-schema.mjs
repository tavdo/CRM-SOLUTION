import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const target = source.replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace('url      = env("DATABASE_URL")', 'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")');
const output = path.join(root, "prisma/postgresql/schema.prisma");
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== target) throw new Error("PostgreSQL schema is stale. Run npm run db:postgres:sync");
} else {
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, target);
  console.log("PostgreSQL schema synchronized; local SQLite schema and data unchanged.");
}
