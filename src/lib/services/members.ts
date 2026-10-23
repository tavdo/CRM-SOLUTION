import type { Role } from "@prisma/client";
import { prisma } from "../db";
import { generateToken, hashToken } from "../crypto";
import { sendMail } from "../email";
import { writeAudit } from "../audit";
import { AppError } from "../errors";
import { enforcePlanLimit } from "../billing/adapter";
import { can } from "../permissions";
import type { WorkspaceContext } from "../auth/workspace";

export async function inviteMember(
  ctx: WorkspaceContext,
  input: { email: string; role: Role },
) {
  if (!can(ctx.role, "company.members")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  if (input.role === "ADMIN" && ctx.role !== "ADMIN") {
    throw new AppError("Cannot assign admin role", "FORBIDDEN", 403);
  }

  await enforcePlanLimit(ctx.company.id, "users");

  const email = input.email.trim().toLowerCase();
  const existingMember = await prisma.membership.findFirst({
    where: { companyId: ctx.company.id, user: { email } },
  });
  if (existingMember) {
    throw new AppError("User is already a member", "ALREADY_MEMBER", 409);
  }

  await prisma.invitation.updateMany({
    where: { companyId: ctx.company.id, email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const token = generateToken(32);
  const invitation = await prisma.invitation.create({
    data: {
      companyId: ctx.company.id,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedById: ctx.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendMail({
    to: email,
    subject: `Invitation to ${ctx.company.name} on CRM Solution`,
    text: `You were invited to join ${ctx.company.name} as ${input.role}.\n\nAccept: ${appUrl}/${ctx.user.preferredLocale}/invite/${token}\n\nThis invitation expires in 7 days and can only be used once by ${email}.`,
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "member.invited",
    entityType: "invitation",
    entityId: invitation.id,
    detail: { email, role: input.role },
  });

  return invitation;
}

export async function acceptInvitation(input: {
  token: string;
  name: string;
  password: string;
  locale: "en" | "ka";
}) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { company: true },
  });

  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    invitation.expiresAt < new Date()
  ) {
    if (invitation && invitation.status === "PENDING") {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
    }
    throw new AppError("Invalid or expired invitation", "INVALID_INVITE");
  }

  await enforcePlanLimit(invitation.companyId, "users");

  const { hashPassword } = await import("../crypto");
  const email = invitation.email.toLowerCase();

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (input.password.length < 8) {
      throw new AppError("Password must be at least 8 characters", "WEAK_PASSWORD");
    }
    user = await prisma.user.create({
      data: {
        email,
        name: input.name.trim() || email,
        passwordHash: await hashPassword(input.password),
        preferredLocale: input.locale,
        emailVerifiedAt: new Date(),
      },
    });
  } else if (input.name.trim()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { preferredLocale: input.locale },
    });
  }

  const existing = await prisma.membership.findUnique({
    where: {
      companyId_userId: { companyId: invitation.companyId, userId: user.id },
    },
  });
  if (existing) {
    throw new AppError("Already a member", "ALREADY_MEMBER", 409);
  }

  // Role comes only from invitation — prevent escalation
  await prisma.$transaction([
    prisma.membership.create({
      data: {
        companyId: invitation.companyId,
        userId: user.id,
        role: invitation.role,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);

  await writeAudit({
    companyId: invitation.companyId,
    actorId: user.id,
    action: "member.joined",
    entityType: "membership",
    entityId: user.id,
    detail: { role: invitation.role, email },
  });

  return { user, company: invitation.company, role: invitation.role };
}

export async function updateMemberRole(
  ctx: WorkspaceContext,
  membershipId: string,
  role: Role,
) {
  if (!can(ctx.role, "company.members")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, companyId: ctx.company.id },
  });
  if (!membership) throw new AppError("Not found", "NOT_FOUND", 404);

  if (membership.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { companyId: ctx.company.id, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError(
        "Cannot remove the last company administrator",
        "LAST_ADMIN",
        400,
      );
    }
  }

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { role },
  });

  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "member.role_changed",
    entityType: "membership",
    entityId: membership.id,
    detail: { from: membership.role, to: role },
  });

  return updated;
}

export async function removeMember(ctx: WorkspaceContext, membershipId: string) {
  if (!can(ctx.role, "company.members")) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, companyId: ctx.company.id },
  });
  if (!membership) throw new AppError("Not found", "NOT_FOUND", 404);

  if (membership.userId === ctx.user.id) {
    throw new AppError("Cannot remove yourself", "CANNOT_REMOVE_SELF");
  }

  if (membership.role === "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { companyId: ctx.company.id, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError(
        "Cannot remove the last company administrator",
        "LAST_ADMIN",
        400,
      );
    }
  }

  await prisma.membership.delete({ where: { id: membership.id } });
  await writeAudit({
    companyId: ctx.company.id,
    actorId: ctx.user.id,
    action: "member.removed",
    entityType: "membership",
    entityId: membership.id,
    detail: { userId: membership.userId },
  });
}
