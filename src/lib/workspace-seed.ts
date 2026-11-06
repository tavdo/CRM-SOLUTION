import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_PIPELINE_STAGES } from "./defaults";

export const PRIMARY_WORKSPACE_ID = "workspace_primary";
export const WORKSPACE_ACCOUNTS = [
  { id: "workspace_admin", email: "admin@crm.local", name: "ადმინისტრატორი", role: "ADMIN" },
  { id: "workspace_manager", email: "manager@crm.local", name: "მენეჯერი", role: "MANAGER" },
  { id: "workspace_user", email: "user@crm.local", name: "მომხმარებელი", role: "EMPLOYEE" },
] as const;

/** Explicit bootstrap: one workspace, three roles, no sample CRM or contractor records.
 * Existing users, changed passwords, memberships and records are never overwritten.
 */
export async function ensureWorkspaceAccounts(db: PrismaClient) {
  if (["live", "preview"].includes(process.env.DEPLOYMENT_MODE || "")) throw new Error("Starter accounts are forbidden in live deployments");
  const passwordHash = await bcrypt.hash("Password123!", 10);
  await db.$transaction(async (tx) => {
    const plan = await tx.plan.upsert({ where: { code: "workspace" }, update: {}, create: {
      id: "plan_workspace", code: "workspace", name: "Workspace", priceMinor: 0,
      maxUsers: 3, maxCustomers: 500, maxDeals: 1000, trialDays: 0,
    } });
    await tx.company.upsert({ where: { id: PRIMARY_WORKSPACE_ID }, update: {}, create: {
      id: PRIMARY_WORKSPACE_ID, slug: "crm-workspace", name: "CRM Workspace", defaultLocale: "ka", currency: "GEL", timezone: "Asia/Tbilisi",
    } });
    await tx.subscription.upsert({ where: { companyId: PRIMARY_WORKSPACE_ID }, update: {}, create: {
      companyId: PRIMARY_WORKSPACE_ID, planId: plan.id, status: "ACTIVE",
    } });
    for (const account of WORKSPACE_ACCOUNTS) {
      const existing = await tx.user.findUnique({ where: { email: account.email } });
      // Never attach a pre-existing account in another workspace to an admin bootstrap.
      if (existing && existing.id !== account.id) throw new Error("Bootstrap email already belongs to another account");
      const user = await tx.user.upsert({ where: { id: account.id }, update: {}, create: {
        id: account.id, email: account.email, name: account.name, preferredLocale: "ka", passwordHash,
      } });
      if (user.email !== account.email) throw new Error("Bootstrap account identifier is already in use");
      await tx.membership.upsert({ where: { companyId_userId: { companyId: PRIMARY_WORKSPACE_ID, userId: user.id } }, update: {},
        create: { companyId: PRIMARY_WORKSPACE_ID, userId: user.id, role: account.role } });
    }
    // Add default stages only to a newly empty pipeline, preserving administrator edits.
    if (await tx.pipelineStage.count({ where: { companyId: PRIMARY_WORKSPACE_ID } }) === 0) {
      await tx.pipelineStage.createMany({ data: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage, companyId: PRIMARY_WORKSPACE_ID })) });
    }
  });
}
