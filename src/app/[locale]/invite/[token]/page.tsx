import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";
import { acceptInviteAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");

  return (
    <AuthShell title={t("inviteTitle")} brand={brand("name")} locale={locale}>
      <AuthForm
        action={acceptInviteAction}
        locale={locale}
        mode="invite"
        token={token}
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
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Use the invited email address. Role is fixed by the invitation.
      </p>
    </AuthShell>
  );
}
