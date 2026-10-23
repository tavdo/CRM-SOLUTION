import { prisma } from "../db";
import { hashPassword, generateToken, hashToken } from "../crypto";
import { uniqueSlug } from "../slug";
import { DEFAULT_PIPELINE_STAGES } from "../defaults";
import { sendMail } from "../email";
import { writeAudit } from "../audit";
import { AppError } from "../errors";
import { createSession, setActiveWorkspace } from "../auth/session";

export async function registerCompany(input: {
  companyName: string;
  adminName: string;
  email: string;
  password: string;
  locale: "en" | "ka";
  timezone?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 8) {
    throw new AppError("Password must be at least 8 characters", "WEAK_PASSWORD");
  }
  if (!input.companyName.trim() || !input.adminName.trim()) {
    throw new AppError("Name is required", "VALIDATION");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email already registered", "EMAIL_TAKEN", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const slug = uniqueSlug(input.companyName, generateToken(6));

  let plan = await prisma.plan.findFirst({
    where: { code: "starter", isActive: true },
  });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        code: "starter",
        name: "Starter",
        description: "Configurable starter plan (placeholder pricing)",
        priceMinor: 0,
        currency: "GEL",
        maxUsers: 10,
        maxCustomers: 500,
        maxDeals: 1000,
        trialDays: 14,
        sortOrder: 0,
      },
    });
  }

  const verifyToken = generateToken(32);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.adminName.trim(),
        passwordHash,
        preferredLocale: input.locale,
      },
    });

    const company = await tx.company.create({
      data: {
        name: input.companyName.trim(),
        slug,
        defaultLocale: input.locale,
        timezone: input.timezone ?? "Asia/Tbilisi",
      },
    });

    await tx.membership.create({
      data: { companyId: company.id, userId: user.id, role: "ADMIN" },
    });

    await tx.pipelineStage.createMany({
      data: DEFAULT_PIPELINE_STAGES.map((s) => ({
        companyId: company.id,
        name: s.name,
        sortOrder: s.sortOrder,
        isWon: s.isWon,
        isLost: s.isLost,
      })),
    });

    const trialEnds = new Date(Date.now() + plan!.trialDays * 24 * 60 * 60 * 1000);
    await tx.subscription.create({
      data: {
        companyId: company.id,
        planId: plan!.id,
        status: "TRIALING",
        trialEndsAt: trialEnds,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnds,
      },
    });

    await tx.emailVerifyToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(verifyToken),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    return { user, company };
  });

  await writeAudit({
    companyId: result.company.id,
    actorId: result.user.id,
    action: "company.created",
    entityType: "company",
    entityId: result.company.id,
    detail: { name: result.company.name },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendMail({
    to: email,
    subject: "Verify your CRM Solution email",
    text: `Welcome to CRM Solution.\n\nVerify your email: ${appUrl}/${input.locale}/verify-email?token=${verifyToken}\n`,
  });

  await createSession(result.user.id);
  await setActiveWorkspace(result.company.id);

  return { userId: result.user.id, companyId: result.company.id, slug: result.company.slug };
}

export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.emailVerifyToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired verification link", "INVALID_TOKEN");
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerifyToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}

export async function requestPasswordReset(emailRaw: string, locale: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  // Always succeed to avoid account enumeration
  if (!user) return;

  const token = generateToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendMail({
    to: email,
    subject: "Reset your CRM Solution password",
    text: `Reset your password: ${appUrl}/${locale}/reset-password?token=${token}\n\nThis link expires in 1 hour.`,
  });
}

export async function resetPassword(token: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters", "WEAK_PASSWORD");
  }
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired reset link", "INVALID_TOKEN");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}
