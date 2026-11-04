import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth/session";
import { listUserWorkspaces, requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ownerScope } from "@/lib/scope";
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

  const [memberships, newLeadsCount] = await Promise.all([
    listUserWorkspaces(user.id),
    prisma.lead
      .count({
        where: { companyId: ctx.company.id, status: "NEW", ...ownerScope(ctx) },
      })
      .catch(() => 0),

  ]);

  const t = await getTranslations("nav");
  const brand = await getTranslations("brand");

  return (
    <AppShell
      locale={locale}
      brand={brand("name")}
      userName={user.name}
      activeCompanyId={ctx.company.id}
      newLeadsCount={newLeadsCount}
      canManageAutomations={can(ctx.role, "company.automations")}
      canManageConstruction={can(ctx.role, "construction.manage")}
      canManageMembers={can(ctx.role, "company.members")}
      workspaces={memberships.map((m) => ({ id: m.companyId, name: m.company.name }))}
      labels={{
        projects: t("projects"),
        tools: t("tools"),
        dashboard: t("dashboard"),
        leads: t("leads"),
        customers: t("customers"),
        deals: t("deals"),
        invoices: t("invoices"),
        products: t("products"),
        tasks: t("tasks"),
        calendar: t("calendar"),
        contactCenter: t("contactCenter"),
        automations: t("automations"),
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
