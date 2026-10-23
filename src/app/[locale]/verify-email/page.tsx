import { getTranslations, setRequestLocale } from "next-intl/server";
import { verifyEmailAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { Alert } from "@/components/ui";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en/verify-email");
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");

  const result = sp.token ? await verifyEmailAction(sp.token) : { error: "missing" };

  return (
    <AuthShell title={t("verifyTitle")} brand={brand("name")} locale={locale}>
      {result.ok ? <Alert tone="ok">{t("verifySuccess")}</Alert> : <Alert>{t("verifyFailed")}</Alert>}
      <Link href={`/${locale}/dashboard`} className="btn btn-primary">
        Continue
      </Link>
    </AuthShell>
  );
}
