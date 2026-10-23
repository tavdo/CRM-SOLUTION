import { PrismaClient } from "@prisma/client";
import { ensureDemoData } from "../src/lib/demo-seed";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_DEMO_DATA === "false") {
    console.log("SEED_DEMO_DATA=false — skipping demo seed");
    return;
  }

  // Clear existing demo companies if re-seeding explicitly via CLI so rich data is populated
  await prisma.company.deleteMany({
    where: { slug: { in: ["demo-alpha", "demo-beta"] } },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "admin@demo-alpha.local",
          "manager@demo-alpha.local",
          "employee@demo-alpha.local",
          "admin@demo-beta.local",
          "manager@demo-beta.local",
          "employee@demo-beta.local",
        ],
      },
    },
  });

  await ensureDemoData(prisma);

  console.log("\n[DEMO-ALPHA] admin@demo-alpha.local / Password123!");
  console.log("[DEMO-BETA]  admin@demo-beta.local  / Password123!");
  console.log("Seed complete. Credentials are local-only demo accounts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
