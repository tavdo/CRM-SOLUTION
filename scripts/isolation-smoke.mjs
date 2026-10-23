import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const alpha = await prisma.company.findUnique({ where: { slug: "demo-alpha" } });
const betaCustomer = await prisma.customer.findFirst({
  where: { company: { slug: "demo-beta" } },
});

if (!alpha || !betaCustomer) {
  console.error("Seed data missing");
  process.exit(1);
}

const leaked = await prisma.customer.findFirst({
  where: { id: betaCustomer.id, companyId: alpha.id },
});

console.log(
  JSON.stringify(
    {
      alphaCompanyId: alpha.id,
      betaCustomerId: betaCustomer.id,
      crossTenantLookup: leaked ? "LEAK" : "blocked",
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
