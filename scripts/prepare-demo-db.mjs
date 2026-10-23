import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const root = process.cwd();
const prismaDir = path.join(root, "prisma");
const demoSeedDb = path.join(prismaDir, "demo-seed.db");
const devDb = path.join(prismaDir, "dev.db");

const env = {
  ...process.env,
  DATABASE_URL: "file:./demo-seed.db",
  SEED_DEMO_DATA: "true",
};

if (fs.existsSync(demoSeedDb)) {
  fs.rmSync(demoSeedDb, { force: true });
}

console.log("[prepare-demo-db] Creating & migrating prisma/demo-seed.db ...");
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });

if (!fs.existsSync(devDb)) {
  fs.copyFileSync(demoSeedDb, devDb);
}

console.log("[prepare-demo-db] Ready: prisma/demo-seed.db");
