import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";
import { signUpAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";
import { isDatabaseRegistrationEnabled } from "@/lib/release-access";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en/sign-up");
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");

  return (
    <AuthShell title={t("signUp")} brand={brand("name")} locale={locale}>
      {isDatabaseRegistrationEnabled() && (
        <p role="status" className="muted" style={{ marginBottom: "1rem" }}>
          {locale === "ka"
            ? "რეგისტრაციის შემდეგ სამუშაო სივრცე მაშინვე გაიხსნება. ელფოსტის დადასტურება საჭირო არ არის. შეინახე პაროლი — პაროლის აღდგენა ელფოსტით და მოწვევების გაგზავნა დროებით მიუწვდომელია."
            : "Your workspace opens immediately after registration. Email verification is not required. Keep your password safe. Password reset emails and email invitations are temporarily unavailable."}
        </p>
      )}
      <AuthForm
        action={signUpAction}
        locale={locale}
        mode="sign-up"
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
        <Link href={`/${locale}/sign-in`}>
          {t("hasAccount")} {t("signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
