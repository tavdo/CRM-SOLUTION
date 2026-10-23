import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { QuickDemoLogin } from "@/components/QuickDemoLogin";
import { Alert } from "@/components/ui";
import { signInAction } from "@/app/actions/auth";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en/sign-in");
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");

  return (
    <AuthShell title={t("signIn")} brand={brand("name")} locale={locale}>
      <div style={{ marginBottom: "1.15rem" }}>
        <QuickDemoLogin locale={locale} compact />
      </div>
      {sp.reset ? <Alert tone="ok">{t("resetSuccess")}</Alert> : null}
      <AuthForm
        action={signInAction}
        locale={locale}
        mode="sign-in"
        next={sp.next}
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
        <Link href={`/${locale}/forgot-password`}>{t("forgotPassword")}</Link>
        {" · "}
        <Link href={`/${locale}/sign-up`}>
          {t("noAccount")} {t("signUp")}
        </Link>
      </p>
    </AuthShell>
  );
}
