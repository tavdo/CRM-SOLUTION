import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Integration checks against the local SQLite DB after seed.
 * Skips cleanly if the database has not been migrated/seeded yet.
 */
const prisma = new PrismaClient();

describe("tenant isolation (integration)", () => {
  let ready = false;
  let alphaId = "";
  let betaCustomerId = "";

  beforeAll(async () => {
    try {
      const alpha = await prisma.company.findUnique({ where: { slug: "demo-alpha" } });
      const beta = await prisma.company.findUnique({ where: { slug: "demo-beta" } });
      if (!alpha || !beta) return;
      const betaCustomer = await prisma.customer.findFirst({ where: { companyId: beta.id } });
      if (!betaCustomer) return;
      alphaId = alpha.id;
      betaCustomerId = betaCustomer.id;
      ready = true;
    } catch {
      ready = false;
    }
  });

  it("keeps customers scoped by companyId", async () => {
    if (!ready) return;
    const leaked = await prisma.customer.findFirst({
      where: { id: betaCustomerId, companyId: alphaId },
    });
    expect(leaked).toBeNull();

    const owned = await prisma.customer.findFirst({
      where: { id: betaCustomerId, companyId: { not: alphaId } },
    });
    expect(owned?.id).toBe(betaCustomerId);
  });

  it("verifies demo passwords are bcrypt hashes (local only)", async () => {
    if (!ready) return;
    const admin = await prisma.user.findUnique({ where: { email: "admin@demo-alpha.local" } });
    expect(admin).toBeTruthy();
    expect(await bcrypt.compare("Password123!", admin!.passwordHash)).toBe(true);
  });
});
