import { PrismaClient } from "@prisma/client";
import { ensureConstructionDemo } from "../src/lib/construction/demo";

const prisma = new PrismaClient();
ensureConstructionDemo(prisma)
  .then(() => console.log("[prepare-demo-db] Construction demo examples added without overwriting existing records."))
  .catch(() => { console.error("[prepare-demo-db] Could not prepare construction demo examples."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
