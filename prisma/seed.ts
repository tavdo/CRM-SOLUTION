import { PrismaClient } from "@prisma/client";
import { ensureWorkspaceAccounts } from "../src/lib/workspace-seed";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_DEMO_DATA === "false") {
    console.log("SEED_DEMO_DATA=false — skipping demo seed");
    return;
  }

  await ensureWorkspaceAccounts(prisma);
  console.log("Workspace prepared with one administrator, one manager and one user. No sample records added.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
