import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/auth/workspace";
import { requireWorkspace } from "@/lib/auth/workspace";
import { isLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en/sign-in");

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/sign-in`);

  let ctx;
  try {
    ctx = await requireWorkspace();
  } catch {
    redirect(`/${locale}/sign-up`);
  }

  const memberships = await listUserWorkspaces(user.id);
  const t = await getTranslations("nav");
  const brand = await getTranslations("brand");

  return (
    <AppShell
      locale={locale}
      brand={brand("name")}
      userName={user.name}
      activeCompanyId={ctx.company.id}
      workspaces={memberships.map((m) => ({ id: m.companyId, name: m.company.name }))}
      labels={{
        dashboard: t("dashboard"),
        customers: t("customers"),
        deals: t("deals"),
        tasks: t("tasks"),
        settings: t("settings"),
        signOut: t("signOut"),
        workspace: t("workspace"),
        switchWorkspace: t("switchWorkspace"),
        menu: t("menu"),
      }}
    >
      {children}
    </AppShell>
  );
}
