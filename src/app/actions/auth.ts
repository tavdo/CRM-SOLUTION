"use server";

import { canUseDemoLogin, isBlockedDemoAccount } from "@/lib/auth/demo";
import { headers } from "next/headers";
import { limitAuthRequest } from "@/lib/rate-limit";
import { previewEmailAllowed, requiresVerifiedEmail } from "@/lib/release-access";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/db-init";
import { verifyPassword } from "@/lib/crypto";
import {
  createSession,
  destroySession,
  setActiveWorkspace,
  clearActiveWorkspace,
  getSessionUser,
} from "@/lib/auth/session";
import {
  registerCompany,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from "@/lib/services/onboarding";
import { acceptInvitation } from "@/lib/services/members";
import { isAppError } from "@/lib/errors";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signUpAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
    await limitAuthRequest("sign-up", await headers(), formString(formData, "email"));
    const schema = z.object({
      companyName: z.string().min(1).max(200),
      adminName: z.string().min(1).max(160),
      email: z.string().email().max(254),
      password: z.string().min(8).max(72),
      locale: z.enum(["en", "ka"]),
    });
    const data = schema.parse({
      companyName: formString(formData, "companyName"),
      adminName: formString(formData, "adminName"),
      email: formString(formData, "email"),
      password: formString(formData, "password"),
      locale: formString(formData, "locale") || "en",
    });
    await registerCompany(data);
    if (requiresVerifiedEmail()) redirect(`/${data.locale}/verify-email`);
    redirect(`/${data.locale}/onboarding`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: isAppError(err) ? err.message : "Unable to sign up" };
  }
}

export async function signInAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
    const email = formString(formData, "email").toLowerCase();
    await limitAuthRequest("sign-in", await headers(), email);
    if (isBlockedDemoAccount(email) || !previewEmailAllowed(email)) return { error: "Invalid email or password" };
    const password = formString(formData, "password");
    const locale = formString(formData, "locale") || "en";
    const next = formString(formData, "next") || `/${locale}/dashboard`;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { error: "Invalid email or password" };
    }

    await createSession(user.id);
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (membership) await setActiveWorkspace(membership.companyId);
    if (requiresVerifiedEmail() && !user.emailVerifiedAt) redirect(`/${locale === "ka" ? "ka" : "en"}/verify-email`);

    const destLocale = user.preferredLocale === "ka" ? "ka" : locale;
    const fallback = `/${destLocale}/dashboard`;
    const normalized =
      next.startsWith(`/${destLocale}/`) ||
      next.startsWith("/en/") ||
      next.startsWith("/ka/")
        ? next.replace(/^\/(en|ka)/, `/${destLocale}`)
        : fallback;
    redirect(
      normalized === `/${destLocale}` || normalized === "/"
        ? fallback
        : normalized,
    );
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: isAppError(err) ? err.message : "Unable to sign in" };
  }
}

export async function signOutAction(formData?: FormData) {
  const locale = formData?.get("locale") === "ka" ? "ka" : "en";
  await destroySession();
  await clearActiveWorkspace();
  redirect(`/${locale}/sign-in`);
}

export async function forgotPasswordAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
    const email = formString(formData, "email");
    const locale = formString(formData, "locale") === "ka" ? "ka" : "en";
    await limitAuthRequest("reset-request", await headers(), email);
    await requestPasswordReset(email, locale);
    return { ok: true };
  } catch (err) {
    return { error: isAppError(err) ? err.message : "Unable to send reset email" };
  }
}

export async function resetPasswordAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
    await limitAuthRequest("reset-password", await headers());
    const token = formString(formData, "token");
    const password = formString(formData, "password");
    const locale = formString(formData, "locale") || "en";
    await resetPassword(token, password);
    redirect(`/${locale}/sign-in?reset=1`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: isAppError(err) ? err.message : "Unable to reset password" };
  }
}

export async function verifyEmailAction(token: string) {
  try {
    await ensureDbInitialized();
    await limitAuthRequest("verify-token", await headers());
    if (!token || token.length > 256) return { error: "Invalid token" };
    await verifyEmail(token);
    return { ok: true };
  } catch (err) {
    return { error: isAppError(err) ? err.message : "Invalid token" };
  }
}

export async function resendVerificationAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
    const user = await getSessionUser();
    if (!user) return { error: "Sign in before requesting a verification email" };
    await limitAuthRequest("verify-email", await headers(), user.email);
    await resendVerificationEmail(user.id, formString(formData, "locale") === "ka" ? "ka" : "en");
    return { ok: true };
  } catch (err) {
    return { error: isAppError(err) ? err.message : "Unable to send verification email" };
  }
}

export async function acceptInviteAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
    await limitAuthRequest("accept-invite", await headers());
    const token = formString(formData, "token");
    const name = formString(formData, "name");
    const password = formString(formData, "password");
    const locale = (formString(formData, "locale") || "en") as "en" | "ka";
    const result = await acceptInvitation({ token, name, password, locale });
    await createSession(result.user.id);
    await setActiveWorkspace(result.company.id);
    redirect(`/${locale}/dashboard`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: isAppError(err) ? err.message : "Unable to accept invite" };
  }
}

export async function switchWorkspaceAction(companyId: string, locale: string) {
  await ensureDbInitialized();
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/sign-in`);
  const membership = await prisma.membership.findUnique({
    where: { companyId_userId: { companyId, userId: user.id } },
  });
  if (!membership) throw new Error("Forbidden");
  await setActiveWorkspace(companyId);
  redirect(`/${locale}/dashboard`);
}

export async function setLocalePreferenceAction(locale: "en" | "ka") {
  await ensureDbInitialized();
  const user = await getSessionUser();
  if (!user) return;
  await prisma.user
    .update({
      where: { id: user.id },
      data: { preferredLocale: locale },
    })
    .catch(() => {});
}

export async function demoLoginAction(formData: FormData) {
  const email = formString(formData, "email") || "admin@crm.local";
  const locale = formString(formData, "locale") === "ka" ? "ka" : "en";
  if (!canUseDemoLogin(email)) throw new Error("Not available");

  await ensureDbInitialized();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    redirect(`/${locale}/sign-in`);
  }

  await createSession(user.id);
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (membership) {
    await setActiveWorkspace(membership.companyId);
  }

  redirect(`/${locale}/dashboard`);
}

function isRedirect(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
