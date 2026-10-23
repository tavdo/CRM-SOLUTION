"use server";

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
} from "@/lib/services/onboarding";
import { acceptInvitation } from "@/lib/services/members";
import { isAppError } from "@/lib/errors";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signUpAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
    const schema = z.object({
      companyName: z.string().min(1),
      adminName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
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
    return { error: "Unable to sign in" };
  }
}

export async function signOutAction() {
  await destroySession();
  await clearActiveWorkspace();
  redirect("/en/sign-in");
}

export async function forgotPasswordAction(_prev: unknown, formData: FormData) {
  await ensureDbInitialized();
  const email = formString(formData, "email");
  const locale = formString(formData, "locale") || "en";
  await requestPasswordReset(email, locale);
  return { ok: true };
}

export async function resetPasswordAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
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
    await verifyEmail(token);
    return { ok: true };
  } catch (err) {
    return { error: isAppError(err) ? err.message : "Invalid token" };
  }
}

export async function acceptInviteAction(_prev: unknown, formData: FormData) {
  try {
    await ensureDbInitialized();
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
  const email = formString(formData, "email") || "admin@demo-alpha.local";
  const locale = (formString(formData, "locale") || "en") as "en" | "ka";

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
