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
  const existingLeads = await prisma.lead
    .count({ where: { companyId: "company_alpha" } })
    .catch(() => 0);
  if (existingLeads > 0) return;

  const plans = [
    {
      id: "plan_starter",
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
      id: "plan_growth",
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
    prefix: "alpha",
    companyName: "Demo Alpha Technologies",
    slug: "demo-alpha",
    taxId: "405318921",
    legalForm: "შპს",
    bogIban: "GE29BG0000000101904917",
    tbcIban: "GE83TB7000000365123456",
    address: "14 Rustaveli Ave, Tbilisi, Georgia",
    phone: "+995 32 240 00 00",
    demoLabel: "DEMO-ALPHA",
    locale: "en",
    admin: { email: "admin@demo-alpha.local", name: "Alpha Admin" },
    manager: { email: "manager@demo-alpha.local", name: "Alpha Manager" },
    employee: { email: "employee@demo-alpha.local", name: "Alpha Employee" },
    customers: [
      {
        name: "DEMO-ALPHA Customer LLC",
        taxId: "404991204",
        legalForm: "შპს",
        bankIban: "GE64BG0000000551290411",
        email: "info@demo-alpha.example",
        phone: "+995 555 100 200",
        website: "https://kuralogistics.example",
        address: "14 Rustaveli Ave, Tbilisi",
      },
      {
        name: "Caucasus Cloud Systems",
        taxId: "405221890",
        legalForm: "შპს",
        bankIban: "GE19TB7700000881234109",
        email: "ops@caucasuscloud.example",
        phone: "+995 577 320 410",
        website: "https://caucasuscloud.example",
        address: "8 Chavchavadze Ave, Tbilisi",
      },
      {
        name: "Batumi Port Freight",
        taxId: "205144890",
        legalForm: "სს",
        bankIban: "GE91BG0000000908112233",
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
    leads: [
      {
        title: "Facebook Inquiry — Vake Retail Chain POS",
        contactName: "Giorgi Maisuradze",
        companyName: "შპს ვაკე რითეილი",
        taxId: "405882109",
        phone: "+995 599 112 334",
        email: "g.maisuradze@vakeretail.ge",
        source: "FACEBOOK",
        status: "NEW",
        amountMinor: 850000,
        notes: "Messaged via Facebook Page — needs 6 POS terminals + RS.ge integration.",
      },
      {
        title: "WhatsApp Lead — Kutaisi Agro Distribution",
        contactName: "Tamuna Kalandadze",
        companyName: "შპს აგრო დისტრიბუცია",
        taxId: "412009481",
        phone: "+995 577 901 220",
        email: "tamuna@agrodist.ge",
        source: "WHATSAPP",
        status: "CONTACTED",
        amountMinor: 1420000,
        notes: "Requested commercial offer in GEL with 18% VAT breakdown.",
      },
      {
        title: "MyPhone SIP Call — Saburtalo Medical Clinic",
        contactName: "Davitabradze Levan",
        companyName: "სს მედიკლინიკა",
        taxId: "204998112",
        phone: "+995 32 255 11 22",
        email: "info@mediclinic.ge",
        source: "MYPHONE",
        status: "QUALIFIED",
        amountMinor: 2200000,
        notes: "Inbound call recorded on MyPhone trunk — ready to convert to Deal.",
      },
      {
        title: "Instagram DM — Boutique Hotel Kazbegi",
        contactName: "Salome Kipiani",
        companyName: "შპს ყაზბეგი ჰოტელს",
        taxId: "405771230",
        phone: "+995 551 440 990",
        email: "salome@kazbegihotel.ge",
        source: "INSTAGRAM",
        status: "NEW",
        amountMinor: 640000,
        notes: "Asked for booking + CRM integration demo.",
      },
    ],
  });

  await seedCompany(prisma, passwordHash, {
    prefix: "beta",
    companyName: "დემო ბეტა სერვისები",
    slug: "demo-beta",
    taxId: "404882910",
    legalForm: "შპს",
    bogIban: "GE44BG0000000334455667",
    tbcIban: "GE12TB7000000998877665",
    address: "თბილისი, ჭავჭავაძის გამზ. 37",
    phone: "+995 32 299 11 00",
    demoLabel: "DEMO-BETA",
    locale: "ka",
    admin: { email: "admin@demo-beta.local", name: "ბეტა ადმინი" },
    manager: { email: "manager@demo-beta.local", name: "Beta Manager" },
    employee: { email: "employee@demo-beta.local", name: "ბეტა თანამშრომელი" },
    customers: [
      {
        name: "DEMO-BETA Customer LLC",
        taxId: "405110982",
        legalForm: "შპს",
        bankIban: "GE55BG0000000771122334",
        email: "info@demo-beta.example",
        phone: "+995 555 000 000",
        website: "https://demobeta.example",
        address: "თბილისი, პეკინის 24",
      },
      {
        name: "შპს კავკასიის ლოგისტიკა",
        taxId: "404339102",
        legalForm: "შპს",
        bankIban: "GE88TB7000000441122990",
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
    leads: [
      {
        title: "Facebook მესენჯერი — ბათუმის სასტუმროს აღჭურვა",
        contactName: "ნიკა შარაშიძე",
        companyName: "შპს ბათუმი პალასი",
        taxId: "445001928",
        phone: "+995 599 300 400",
        email: "nika@batumipalace.ge",
        source: "FACEBOOK",
        status: "NEW",
        amountMinor: 1650000,
        notes: "ითხოვს ინვოისს დღგ-ს ჩათვლით საქართველოს ბანკის ანგარიშზე.",
      },
      {
        title: "MyPhone ზარი — ქუთაისის სადისტრიბუციო ქსელი",
        contactName: "ეკა ლომიძე",
        companyName: "შპს იმერეთი თრეიდი",
        taxId: "412883901",
        phone: "+995 577 110 880",
        email: "eka@imeretitrade.ge",
        source: "MYPHONE",
        status: "QUALIFIED",
        amountMinor: 920000,
        notes: "მზად არის ხელშეკრულების გასაფორმებლად.",
      },
    ],
  });
}

async function seedCompany(
  prisma: PrismaClient,
  passwordHash: string,
  opts: {
    prefix: string;
    companyName: string;
    slug: string;
    taxId: string;
    legalForm: string;
    bogIban: string;
    tbcIban: string;
    address: string;
    phone: string;
    demoLabel: string;
    locale: string;
    admin: { email: string; name: string };
    manager: { email: string; name: string };
    employee: { email: string; name: string };
    customers: {
      name: string;
      taxId: string;
      legalForm: string;
      bankIban: string;
      email: string;
      phone: string;
      website: string;
      address: string;
    }[];
    deals: { title: string; stageIdx: number; amountMinor: number; custIdx: number; won?: boolean }[];
    leads: {
      title: string;
      contactName: string;
      companyName: string;
      taxId: string;
      phone: string;
      email: string;
      source: string;
      status: string;
      amountMinor: number;
      notes: string;
    }[];
  },
) {
  const starter = await prisma.plan.findUniqueOrThrow({ where: { code: "starter" } });
  const p = opts.prefix;

  const admin = await prisma.user.upsert({
    where: { email: opts.admin.email },
    create: {
      id: `user_${p}_admin`,
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
      id: `user_${p}_manager`,
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
      id: `user_${p}_employee`,
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
      id: `company_${p}`,
      name: opts.companyName,
      slug: opts.slug,
      taxId: opts.taxId,
      legalForm: opts.legalForm,
      isVatPayer: true,
      bogIban: opts.bogIban,
      tbcIban: opts.tbcIban,
      address: opts.address,
      phone: opts.phone,
      timezone: "Asia/Tbilisi",
      defaultLocale: opts.locale,
      currency: "GEL",
    },
    update: {
      name: opts.companyName,
      taxId: opts.taxId,
      legalForm: opts.legalForm,
      bogIban: opts.bogIban,
      tbcIban: opts.tbcIban,
      address: opts.address,
      phone: opts.phone,
    },
  });

  for (const [u, role, dept, title] of [
    [admin, "ADMIN", "Management / დირექცია", "CEO & Founder"],
    [manager, "MANAGER", "Sales / გაყიდვების დეპარტამენტი", "Head of Sales"],
    [employee, "EMPLOYEE", "Sales / გაყიდვების დეპარტამენტი", "Account Executive"],
  ] as const) {
    await prisma.membership.upsert({
      where: { companyId_userId: { companyId: company.id, userId: u.id } },
      create: {
        id: `mem_${p}_${role.toLowerCase()}`,
        companyId: company.id,
        userId: u.id,
        role,
        departmentName: dept,
        jobTitle: title,
      },
      update: { role, departmentName: dept, jobTitle: title },
    });
  }

  const stageCount = await prisma.pipelineStage.count({ where: { companyId: company.id } });
  if (stageCount === 0) {
    for (const s of STAGES) {
      await prisma.pipelineStage.create({
        data: {
          id: `stage_${p}_${s.sortOrder}`,
          companyId: company.id,
          name: s.name,
          sortOrder: s.sortOrder,
          isWon: s.isWon,
          isLost: s.isLost,
        },
      });
    }
  }

  await prisma.subscription.upsert({
    where: { companyId: company.id },
    create: {
      id: `sub_${p}`,
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

  const createdCustomers = [];
  for (let i = 0; i < opts.customers.length; i++) {
    const c = opts.customers[i];
    const cust = await prisma.customer.upsert({
      where: { id: `cust_${p}_${i}` },
      create: {
        id: `cust_${p}_${i}`,
        companyId: company.id,
        name: c.name,
        taxId: c.taxId,
        legalForm: c.legalForm,
        isVatPayer: true,
        bankIban: c.bankIban,
        email: c.email,
        phone: c.phone,
        website: c.website,
        address: c.address,
        ownerId: manager.id,
      },
      update: {
        taxId: c.taxId,
        legalForm: c.legalForm,
        bankIban: c.bankIban,
      },
    });
    createdCustomers.push(cust);
  }

  await prisma.contact.upsert({
    where: { id: `contact_${p}_0` },
    create: {
      id: `contact_${p}_0`,
      companyId: company.id,
      customerId: createdCustomers[0].id,
      firstName: "Nino",
      lastName: "Beridze",
      email: `nino@${opts.slug}.example`,
      phone: "+995 599 10 20 30",
      title: "Head of Operations",
      ownerId: employee.id,
    },
    update: {},
  });

  const createdDeals = [];
  for (let i = 0; i < opts.deals.length; i++) {
    const d = opts.deals[i];
    const stage = stages[d.stageIdx] ?? stages[0];
    const cust = createdCustomers[d.custIdx] ?? createdCustomers[0];
    const deal = await prisma.deal.upsert({
      where: { id: `deal_${p}_${i}` },
      create: {
        id: `deal_${p}_${i}`,
        companyId: company.id,
        title: d.title,
        customerId: cust.id,
        stageId: stage.id,
        ownerId: d.won ? manager.id : employee.id,
        amountMinor: d.amountMinor,
        currency: "GEL",
        status: d.won ? "WON" : "OPEN",
        closedAt: d.won ? new Date() : null,
        expectedCloseAt: new Date(Date.now() + (i + 3) * 2 * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
    createdDeals.push(deal);
    await prisma.dealActivity.upsert({
      where: { id: `act_${p}_${i}` },
      create: {
        id: `act_${p}_${i}`,
        companyId: company.id,
        dealId: deal.id,
        actorId: admin.id,
        action: d.won ? "won" : "created",
        detail: JSON.stringify({ seed: true }),
      },
      update: {},
    });
  }

  // Seed Leads
  for (let i = 0; i < opts.leads.length; i++) {
    const l = opts.leads[i];
    await prisma.lead.upsert({
      where: { id: `lead_${p}_${i}` },
      create: {
        id: `lead_${p}_${i}`,
        companyId: company.id,
        title: l.title,
        contactName: l.contactName,
        companyName: l.companyName,
        taxId: l.taxId,
        phone: l.phone,
        email: l.email,
        source: l.source,
        status: l.status,
        amountMinor: l.amountMinor,
        currency: "GEL",
        notes: l.notes,
        ownerId: i % 2 === 0 ? employee.id : manager.id,
      },
      update: {},
    });
  }

  // Seed Products Catalog
  const productsData = [
    {
      id: `prod_${p}_0`,
      sku: "CRM-ENT-GE",
      name: opts.locale === "ka" ? "CRM სისტემის დანერგვა და კონფიგურაცია" : "CRM Implementation & Configuration",
      description: "Full workspace setup, RS.ge & BOG/TBC invoice templates, team training",
      unit: "პაკეტი",
      priceMinor: 1250000,
    },
    {
      id: `prod_${p}_1`,
      sku: "CLOUD-ERP-01",
      name: opts.locale === "ka" ? "საწყობის და ERP ინტეგრაცია" : "Warehouse & Cloud ERP Integration",
      description: "Two-way inventory sync, barcode support, RS.ge waybill readiness",
      unit: "პაკეტი",
      priceMinor: 2800000,
    },
    {
      id: `prod_${p}_2`,
      sku: "SLA-MONTH",
      name: opts.locale === "ka" ? "ყოველთვიური ტექნიკური მხარდაჭერა (SLA)" : "Monthly Priority Support (SLA)",
      description: "24/7 dedicated Georgian & English account support",
      unit: "თვე",
      priceMinor: 640000,
    },
  ];
  for (const prod of productsData) {
    await prisma.product.upsert({
      where: { id: prod.id },
      create: {
        ...prod,
        companyId: company.id,
        currency: "GEL",
        vatIncluded: true,
      },
      update: {},
    });
  }

  // Seed Georgian Invoices (with 18% დღგ & RS.ge waybill ref)
  const inv1Subtotal = 1250000;
  const inv1Vat = Math.round(inv1Subtotal * 0.18);
  await prisma.invoice.upsert({
    where: { id: `inv_${p}_0` },
    create: {
      id: `inv_${p}_0`,
      companyId: company.id,
      invoiceNumber: `INV-2026-${p.toUpperCase()}-001`,
      customerId: createdCustomers[0].id,
      dealId: createdDeals[0].id,
      status: "PAID",
      issueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      subtotalMinor: inv1Subtotal,
      vatRate: 18,
      vatMinor: inv1Vat,
      totalMinor: inv1Subtotal + inv1Vat,
      currency: "GEL",
      includeVat: true,
      bankPreference: "BOG_TBC",
      rsGeWaybillRef: "RS-0749182041",
      notes: "გადახდა შესაძლებელია საქართველოს ბანკის ან თიბისი ბანკის ანგარიშზე. დანიშნულებაში მიუთითეთ ინვოისის ნომერი.",
      items: {
        create: [
          {
            id: `inv_item_${p}_0`,
            productId: `prod_${p}_0`,
            description: productsData[0].name,
            quantity: 1,
            unit: "პაკეტი",
            unitMinor: inv1Subtotal,
            totalMinor: inv1Subtotal,
          },
        ],
      },
    },
    update: {},
  });

  const inv2Subtotal = 2800000;
  const inv2Vat = Math.round(inv2Subtotal * 0.18);
  if (createdCustomers[1]) {
    await prisma.invoice.upsert({
      where: { id: `inv_${p}_1` },
      create: {
        id: `inv_${p}_1`,
        companyId: company.id,
        invoiceNumber: `INV-2026-${p.toUpperCase()}-002`,
        customerId: createdCustomers[1].id,
        dealId: createdDeals[1]?.id ?? createdDeals[0].id,
        status: "SENT",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        subtotalMinor: inv2Subtotal,
        vatRate: 18,
        vatMinor: inv2Vat,
        totalMinor: inv2Subtotal + inv2Vat,
        currency: "GEL",
        includeVat: true,
        bankPreference: "BOG_TBC",
        rsGeWaybillRef: "RS-0749182099",
        notes: "ანგარიშ-ფაქტურა ატვირთულია RS.ge პორტალზე (დღგ 18%).",
        items: {
          create: [
            {
              id: `inv_item_${p}_1`,
              productId: `prod_${p}_1`,
              description: productsData[1].name,
              quantity: 1,
              unit: "პაკეტი",
              unitMinor: inv2Subtotal,
              totalMinor: inv2Subtotal,
            },
          ],
        },
      },
      update: {},
    });
  }

  // Seed Tasks (with Kanban boardStage & priority)
  await prisma.task.upsert({
    where: { id: `task_${p}_0` },
    create: {
      id: `task_${p}_0`,
      companyId: company.id,
      title: "Follow up call with decision maker",
      description: "DEMO seed task — review proposal scope and timeline",
      priority: "HIGH",
      boardStage: "IN_PROGRESS",
      dueAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      ownerId: employee.id,
      creatorId: admin.id,
      customerId: createdCustomers[0].id,
      dealId: createdDeals[0].id,
    },
    update: {},
  });

  await prisma.task.upsert({
    where: { id: `task_${p}_1` },
    create: {
      id: `task_${p}_1`,
      companyId: company.id,
      title: "Send commercial proposal & Georgian VAT invoice",
      priority: "URGENT",
      boardStage: "TODO",
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      ownerId: manager.id,
      creatorId: admin.id,
      customerId: createdCustomers[1]?.id ?? createdCustomers[0].id,
      dealId: createdDeals[1]?.id ?? createdDeals[0].id,
    },
    update: {},
  });

  // Seed Company Feed & Team Chat
  await prisma.feedPost.upsert({
    where: { id: `feed_${p}_0` },
    create: {
      id: `feed_${p}_0`,
      companyId: company.id,
      authorId: admin.id,
      title: "Q4 Sales Target & Georgian Invoice Automation Launched",
      body: "ჩვენი ახალი CRM სივრცე გაშვებულია! ყველა შემომავალი ლიდი Facebook-იდან, WhatsApp-იდან და MyPhone-იდან ავტომატურად ხვდება ლიდების მოდულში. ინვოისები გენერირდება ს/კ-ით, 18% დღგ-ით და BOG/TBC IBAN ანგარიშებით.",
      category: "ANNOUNCEMENT",
      pinned: true,
    },
    update: {},
  });

  await prisma.feedPost.upsert({
    where: { id: `feed_${p}_1` },
    create: {
      id: `feed_${p}_1`,
      companyId: company.id,
      authorId: manager.id,
      title: "Deal Won: Core CRM Onboarding Package (15,000 GEL)",
      body: "Closed the onboarding package with DEMO-ALPHA Customer LLC. Invoice INV-2026-001 has been marked PAID via Bank of Georgia corporate transfer.",
      category: "WIN",
      pinned: false,
    },
    update: {},
  });

  const chatSeed = [
    {
      id: `chat_${p}_0`,
      authorId: admin.id,
      channel: "general",
      body: "დილა მშვიდობისა გუნდო! დღეს 15:00-ზე გვაქვს კვირის მილის განხილვა.",
    },
    {
      id: `chat_${p}_1`,
      authorId: manager.id,
      channel: "sales",
      body: "Batumi Port Freight-ის ინვოისი (ს/კ 205144890) გავამზადე, დღეს გადავუგზავნი თიბისის რეკვიზიტებით.",
    },
    {
      id: `chat_${p}_2`,
      authorId: employee.id,
      channel: "sales",
      body: "Facebook-იდან ახალი ლიდი შემოვიდა (შპს ვაკე რითეილი) — უკვე დავუკავშირდი და გადამყავს გარიგებაში!",
    },
  ];
  for (const msg of chatSeed) {
    await prisma.chatMessage.upsert({
      where: { id: msg.id },
      create: {
        ...msg,
        companyId: company.id,
      },
      update: {},
    });
  }

  // Seed HR Departments, Worktime Clock-In, and Leave Requests
  const depts = [
    { id: `dept_${p}_0`, name: "Management / დირექცია", headName: opts.admin.name, memberCount: 2 },
    { id: `dept_${p}_1`, name: "Sales & B2B / გაყიდვების დეპარტამენტი", headName: opts.manager.name, memberCount: 6 },
    { id: `dept_${p}_2`, name: "Client Success & Support / მხარდაჭერა", headName: opts.employee.name, memberCount: 4 },
    { id: `dept_${p}_3`, name: "Finance & RS.ge Accounting / ფინანსები", headName: "Nino K.", memberCount: 2 },
  ];
  for (const d of depts) {
    await prisma.department.upsert({
      where: { id: d.id },
      create: { ...d, companyId: company.id },
      update: {},
    });
  }

  await prisma.workLog.upsert({
    where: { id: `work_${p}_0` },
    create: {
      id: `work_${p}_0`,
      companyId: company.id,
      userId: admin.id,
      status: "WORKING",
      clockInAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      note: "Tbilisi HQ Office",
    },
    update: {},
  });

  await prisma.leaveRequest.upsert({
    where: { id: `leave_${p}_0` },
    create: {
      id: `leave_${p}_0`,
      companyId: company.id,
      userId: employee.id,
      leaveType: "VACATION",
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: "APPROVED",
      reason: "კუთვნილი ანაზღაურებადი შვებულება (5 სამუშაო დღე)",
    },
    update: {},
  });

  // Seed Pipeline Automation Rules (Bitrix24-style Robots)
  if (stages[2]) {
    await prisma.automationRule.upsert({
      where: { id: `auto_${p}_0` },
      create: {
        id: `auto_${p}_0`,
        companyId: company.id,
        name: "Proposal Stage → Auto-create Invoice & SLA Follow-up Task",
        triggerStageId: stages[2].id,
        actionType: "CREATE_TASK",
        actionDetail: "მოამზადეთ და გაუგზავნეთ ქართული ინვოისი (დღგ 18%) და ხელშეკრულება",
        isActive: true,
      },
      update: {},
    });
  }
  if (stages[4]) {
    await prisma.automationRule.upsert({
      where: { id: `auto_${p}_1` },
      create: {
        id: `auto_${p}_1`,
        companyId: company.id,
        name: "Won Stage → Announce Deal Win in Company Feed",
        triggerStageId: stages[4].id,
        actionType: "POST_FEED",
        actionDetail: "გილოცავთ! გარიგება წარმატებით დაიხურა (WON).",
        isActive: true,
      },
      update: {},
    });
  }

  await prisma.customFieldDefinition.upsert({
    where: { id: `cf_${p}_industry` },
    create: {
      id: `cf_${p}_industry`,
      companyId: company.id,
      name: "Industry",
      key: "industry",
      fieldType: "SELECT",
      options: JSON.stringify(["Technology", "Logistics", "Retail", "Hospitality", "Services"]),
    },
    update: {},
  });

  await prisma.note.upsert({
    where: { id: `note_${p}_0` },
    create: {
      id: `note_${p}_0`,
      companyId: company.id,
      customerId: createdCustomers[0].id,
      authorId: admin.id,
      body: "DEMO: Initial discovery notes — client wants bilingual workspace for 15 sales reps + RS.ge invoice export.",
    },
    update: {},
  });

  const inviteToken = `demo-invite-${opts.slug}`;
  await prisma.invitation.upsert({
    where: { tokenHash: hashToken(inviteToken) },
    create: {
      id: `inv_${p}_0`,
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
