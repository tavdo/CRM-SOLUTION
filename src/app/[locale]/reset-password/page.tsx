import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";
import { resetPasswordAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { Alert } from "@/components/ui";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en/reset-password");
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");

  if (!sp.token) {
    return (
      <AuthShell title={t("resetPassword")} brand={brand("name")} locale={locale}>
        <Alert>{t("verifyFailed")}</Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("resetPassword")} brand={brand("name")} locale={locale}>
      <AuthForm
        action={resetPasswordAction}
        locale={locale}
        mode="reset"
        token={sp.token}
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
    </AuthShell>
  );
}
