import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { projectWorkspace } from "@/lib/construction/read";
import { can } from "@/lib/permissions";
import { isAppError } from "@/lib/errors";
import { Alert, Badge } from "@/components/ui";
import { OverviewPanel, EstimatesPanel, BudgetPanel, WorkPanel, MaterialsPanel, SubcontractsPanel, FinancePanel, DocumentsPanel } from "@/components/construction/ProjectPanels";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ tab?: string; saved?: string; error?: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const ctx = await requireWorkspace();
  const t = await getTranslations("construction");
  const data = await projectWorkspace(ctx, id).catch((error) => { if (isAppError(error) && error.status === 404) notFound(); throw error; });
  const manage = can(ctx.role, "construction.manage");
  const panels = { overview: OverviewPanel, work: WorkPanel, materials: MaterialsPanel, documents: DocumentsPanel, ...(data.finance ? { estimates: EstimatesPanel, budget: BudgetPanel, subcontracts: SubcontractsPanel, finance: FinancePanel } : {}) };
  const requested = query.tab || "overview";
  const tab = Object.hasOwn(panels, requested) ? requested as keyof typeof panels : "overview";
  const Component = panels[tab]!;
  return <div className="construction-stack"><Link href={`/${locale}/projects`}>← {t("projects")}</Link><div className="construction-heading"><div><span className="kicker">{data.project.number}</span><h1 className="page-title">{data.project.name}</h1><p className="muted">{data.customer?.name} · {data.project.address}</p></div><Badge tone={data.project.status === "ACTIVE" ? "ok" : "default"}>{t(`status.${data.project.status}`)}</Badge></div>
    {query.saved ? <Alert tone="ok">{t("saved")}</Alert> : null}{query.error ? <Alert>{t(`errors.${t.has(`errors.${query.error}`) ? query.error : "C_ERROR"}`)}</Alert> : null}
    <nav className="construction-tabs" aria-label={t("projectTabs")}>{["overview", "estimates", "budget", "work", "materials", "subcontracts", "finance", "documents"].filter((key) => Object.hasOwn(panels, key)).map((key) => <Link key={key} className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} href={`/${locale}/projects/${id}?tab=${key}`}>{t(key)}</Link>)}</nav><Component data={data} locale={locale} manage={manage} />
  </div>;
}
