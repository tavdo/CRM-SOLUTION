import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";
import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en/forgot-password");
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");

  return (
    <AuthShell title={t("forgotPassword")} brand={brand("name")} locale={locale}>
      <AuthForm
        action={forgotPasswordAction}
        locale={locale}
        mode="forgot"
        labels={{
          email: t("email"),
          password: t("password"),
          signIn: t("signIn"),
          signUp: t("signUp"),
          sendReset: t("sendReset"),
          resetPassword: t("resetPassword"),
          newPassword: t("newPassword"),
          acceptInvite: t("acceptInvite"),
          name: t("name"),
          companyName: t("companyName"),
          language: t("language"),
          resetSent: t("resetSent"),
        }}
      />
      <p className="muted" style={{ marginTop: "1rem" }}>
        <Link href={`/${locale}/sign-in`}>{t("signIn")}</Link>
      </p>
    </AuthShell>
  );
}
