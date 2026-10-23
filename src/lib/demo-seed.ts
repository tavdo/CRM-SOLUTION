import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const STAGES = [
  { name: "New", sortOrder: 0, isWon: false, isLost: false },
  { name: "Qualified", sortOrder: 1, isWon: false, isLost: false },
  { name: "Proposal", sortOrder: 2, isWon: false, isLost: false },
  { name: "Negotiation", sortOrder: 3, isWon: false, isLost: false },
  { name: "Won", sortOrder: 4, isWon: true, isLost: false },
  { name: "Lost", sortOrder: 5, isWon: false, isLost: true },
];

export async function ensureDemoData(prisma: PrismaClient): Promise<void> {
  const existingAlpha = await prisma.user.findUnique({
    where: { email: "admin@demo-alpha.local" },
  });
  if (existingAlpha) return;

  const plans = [
    {
      code: "starter",
      name: "Starter",
      description: "Placeholder starter plan — prices not commercially approved",
      priceMinor: 4900,
      currency: "GEL",
      maxUsers: 10,
      maxCustomers: 500,
      maxDeals: 1000,
      trialDays: 14,
      sortOrder: 0,
    },
    {
      code: "growth",
      name: "Growth",
      description: "Placeholder growth plan — prices not commercially approved",
      priceMinor: 14900,
      currency: "GEL",
      maxUsers: 25,
      maxCustomers: 2000,
      maxDeals: 5000,
      trialDays: 14,
      sortOrder: 1,
    },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { code: p.code },
      create: p,
      update: p,
    });
  }

  const passwordHash = await bcrypt.hash("Password123!", 10);

  await seedCompany(prisma, passwordHash, {
    companyName: "Demo Alpha Technologies",
    slug: "demo-alpha",
    demoLabel: "DEMO-ALPHA",
    locale: "en",
    admin: { email: "admin@demo-alpha.local", name: "Alpha Admin" },
    manager: { email: "manager@demo-alpha.local", name: "Alpha Manager" },
    employee: { email: "employee@demo-alpha.local", name: "Alpha Employee" },
    customers: [
      {
        name: "DEMO-ALPHA Customer LLC",
        email: "info@demo-alpha.example",
        phone: "+995 555 100 200",
        website: "https://kuralogistics.example",
        address: "14 Rustaveli Ave, Tbilisi",
      },
      {
        name: "Caucasus Cloud Systems",
        email: "ops@caucasuscloud.example",
        phone: "+995 577 320 410",
        website: "https://caucasuscloud.example",
        address: "8 Chavchavadze Ave, Tbilisi",
      },
      {
        name: "Batumi Port Freight",
        email: "procurement@batumiport.example",
        phone: "+995 599 880 112",
        website: "https://batumiport.example",
        address: "2 Gogebashvili St, Batumi",
      },
    ],
    deals: [
      { title: "DEMO-ALPHA website redesign", stageIdx: 0, amountMinor: 1250000, custIdx: 0 },
      { title: "Cloud ERP & Warehouse Integration", stageIdx: 1, amountMinor: 2800000, custIdx: 1 },
      { title: "Annual Fleet Telemetry Contract", stageIdx: 2, amountMinor: 1950000, custIdx: 2 },
      { title: "Security Audit & SSO Rollout", stageIdx: 3, amountMinor: 980000, custIdx: 1 },
      { title: "Core CRM Onboarding Package", stageIdx: 4, amountMinor: 1500000, custIdx: 0, won: true },
    ],
  });

  await seedCompany(prisma, passwordHash, {
    companyName: "დემო ბეტა სერვისები",
    slug: "demo-beta",
    demoLabel: "DEMO-BETA",
    locale: "ka",
    admin: { email: "admin@demo-beta.local", name: "ბეტა ადმინი" },
    manager: { email: "manager@demo-beta.local", name: "Beta Manager" },
    employee: { email: "employee@demo-beta.local", name: "ბეტა თანამშრომელი" },
    customers: [
      {
        name: "DEMO-BETA Customer LLC",
        email: "info@demo-beta.example",
        phone: "+995 555 000 000",
        website: "https://demobeta.example",
        address: "თბილისი, პეკინის 24",
      },
      {
        name: "შპს კავკასიის ლოგისტიკა",
        email: "contact@kavkasia.example",
        phone: "+995 599 441 220",
        website: "https://kavkasia.example",
        address: "თბილისი, აღმაშენებლის ხეივანი 12",
      },
    ],
    deals: [
      { title: "DEMO-BETA website redesign", stageIdx: 0, amountMinor: 250000, custIdx: 0 },
      { title: "საწყობის ავტომატიზაცია", stageIdx: 2, amountMinor: 1850000, custIdx: 1 },
      { title: "ტექნიკური მხარდაჭერის პაკეტი", stageIdx: 4, amountMinor: 640000, custIdx: 0, won: true },
    ],
  });
}

async function seedCompany(
  prisma: PrismaClient,
  passwordHash: string,
  opts: {
    companyName: string;
    slug: string;
    demoLabel: string;
    locale: string;
    admin: { email: string; name: string };
    manager: { email: string; name: string };
    employee: { email: string; name: string };
    customers: { name: string; email: string; phone: string; website: string; address: string }[];
    deals: { title: string; stageIdx: number; amountMinor: number; custIdx: number; won?: boolean }[];
  },
) {
  const starter = await prisma.plan.findUniqueOrThrow({ where: { code: "starter" } });

  const admin = await prisma.user.upsert({
    where: { email: opts.admin.email },
    create: {
      email: opts.admin.email,
      name: opts.admin.name,
      passwordHash,
      preferredLocale: opts.locale,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, name: opts.admin.name },
  });

  const manager = await prisma.user.upsert({
    where: { email: opts.manager.email },
    create: {
      email: opts.manager.email,
      name: opts.manager.name,
      passwordHash,
      preferredLocale: opts.locale,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, name: opts.manager.name },
  });

  const employee = await prisma.user.upsert({
    where: { email: opts.employee.email },
    create: {
      email: opts.employee.email,
      name: opts.employee.name,
      passwordHash,
      preferredLocale: opts.locale,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, name: opts.employee.name },
  });

  const company = await prisma.company.upsert({
    where: { slug: opts.slug },
    create: {
      name: opts.companyName,
      slug: opts.slug,
      timezone: "Asia/Tbilisi",
      defaultLocale: opts.locale,
      currency: "GEL",
    },
    update: { name: opts.companyName },
  });

  for (const [u, role] of [
    [admin, "ADMIN"],
    [manager, "MANAGER"],
    [employee, "EMPLOYEE"],
  ] as const) {
    await prisma.membership.upsert({
      where: { companyId_userId: { companyId: company.id, userId: u.id } },
      create: { companyId: company.id, userId: u.id, role },
      update: { role },
    });
  }

  const stageCount = await prisma.pipelineStage.count({ where: { companyId: company.id } });
  if (stageCount === 0) {
    await prisma.pipelineStage.createMany({
      data: STAGES.map((s) => ({ ...s, companyId: company.id })),
    });
  }

  await prisma.subscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      planId: starter.id,
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });

  const stages = await prisma.pipelineStage.findMany({
    where: { companyId: company.id, archivedAt: null },
    orderBy: { sortOrder: "asc" },
  });

  const existingCustomers = await prisma.customer.count({ where: { companyId: company.id } });
  if (existingCustomers === 0) {
    const createdCustomers = [];
    for (const c of opts.customers) {
      const cust = await prisma.customer.create({
        data: {
          companyId: company.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          website: c.website,
          address: c.address,
          ownerId: manager.id,
        },
      });
      createdCustomers.push(cust);
    }

    await prisma.contact.create({
      data: {
        companyId: company.id,
        customerId: createdCustomers[0].id,
        firstName: "Nino",
        lastName: "Beridze",
        email: `nino@${opts.slug}.example`,
        title: "Head of Operations",
        ownerId: employee.id,
      },
    });

    const createdDeals = [];
    for (const d of opts.deals) {
      const stage = stages[d.stageIdx] ?? stages[0];
      const cust = createdCustomers[d.custIdx] ?? createdCustomers[0];
      const deal = await prisma.deal.create({
        data: {
          companyId: company.id,
          title: d.title,
          customerId: cust.id,
          stageId: stage.id,
          ownerId: d.won ? manager.id : employee.id,
          amountMinor: d.amountMinor,
          currency: "GEL",
          status: d.won ? "WON" : "OPEN",
          closedAt: d.won ? new Date() : null,
          expectedCloseAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      createdDeals.push(deal);
      await prisma.dealActivity.create({
        data: {
          companyId: company.id,
          dealId: deal.id,
          actorId: admin.id,
          action: d.won ? "won" : "created",
          detail: JSON.stringify({ seed: true }),
        },
      });
    }

    await prisma.task.create({
      data: {
        companyId: company.id,
        title: "Follow up call with decision maker",
        description: "DEMO seed task — review proposal scope and timeline",
        dueAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        ownerId: employee.id,
        creatorId: admin.id,
        customerId: createdCustomers[0].id,
        dealId: createdDeals[0].id,
      },
    });

    await prisma.task.create({
      data: {
        companyId: company.id,
        title: "Send commercial proposal & SLA",
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        ownerId: manager.id,
        creatorId: admin.id,
        customerId: createdCustomers[1]?.id ?? createdCustomers[0].id,
        dealId: createdDeals[1]?.id ?? createdDeals[0].id,
      },
    });

    await prisma.customFieldDefinition.create({
      data: {
        companyId: company.id,
        name: "Industry",
        key: "industry",
        fieldType: "SELECT",
        options: JSON.stringify(["Technology", "Logistics", "Retail", "Services"]),
      },
    });

    await prisma.note.create({
      data: {
        companyId: company.id,
        customerId: createdCustomers[0].id,
        authorId: admin.id,
        body: "DEMO: Initial discovery notes — client wants bilingual workspace for 15 sales reps.",
      },
    });
  }

  const inviteToken = `demo-invite-${opts.slug}`;
  await prisma.invitation.upsert({
    where: { tokenHash: hashToken(inviteToken) },
    create: {
      companyId: company.id,
      email: `pending@${opts.slug}.example`,
      role: "EMPLOYEE",
      tokenHash: hashToken(inviteToken),
      invitedById: admin.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });
}
