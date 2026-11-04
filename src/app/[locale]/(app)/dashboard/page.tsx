import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getDashboard } from "@/lib/services/dashboard";
import { dateInTimezone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Metric, Panel } from "@/components/construction/ProjectPanels";
import { Badge, EmptyState } from "@/components/ui";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("construction");
  const d = await getDashboard(ctx);
  return <div className="construction-stack"><div className="construction-heading"><div><span className="kicker">{ctx.company.name}</span><h1 className="page-title">{t("dashboard")}</h1><p className="muted">{t("dashboardIntro")}</p></div><Link href={`/${locale}/projects`} className="btn btn-primary">{t("projects")}</Link></div>
    <div className="construction-grid"><Metric label={t("activeProjects")} value={String(d.activeCount)} /><Metric label={t("overdueWork")} value={String(d.overdueCount)} warning={d.overdueCount > 0} />{d.finance ? <><Metric label={t("overBudget")} value={String(d.finance.overBudget.length)} warning={d.finance.overBudget.length > 0} /><Metric label={t("pendingPurchases")} value={String(d.finance.pendingPurchases)} /><Metric label={t("pendingActs")} value={String(d.finance.pendingActs)} /></> : null}</div>
    {d.finance ? <Panel title={t("cashOverview")}><p className="muted">{t("cashDefinition")}</p><div className="construction-grid">{d.finance.currencies.map((row) => <div key={row.currency}><Metric label={`${t("receivable")} · ${row.currency}`} value={formatMoney(row.receivable, row.currency, locale)} /><Metric label={`${t("costBalance")} · ${row.currency}`} value={formatMoney(row.payable, row.currency, locale)} /></div>)}</div></Panel> : null}
    <Panel title={t("projects")}>{d.projects.length ? d.projects.map((p) => <div className="construction-item" key={p.id}><div className="construction-row"><Link href={`/${locale}/projects/${p.id}`}><strong>{p.number} · {p.name}</strong></Link><Badge>{t(`status.${p.status}`)}</Badge></div><p className="muted">{t("endDate")}: {p.endDate?.toISOString().slice(0, 10) || "—"} · {p.progress}%</p><progress value={p.progress} max="100" aria-label={p.name} /></div>) : <EmptyState>{t("emptyProjects")}</EmptyState>}</Panel>
    <Panel title={t("overdueWork")}>{d.overdueTasks.map((task) => <div className="construction-item" key={task.id}><Link href={task.projectId ? `/${locale}/projects/${task.projectId}?tab=work` : `/${locale}/tasks/${task.id}`}>{task.title}</Link><p className="muted">{task.owner.name} · {task.dueAt ? dateInTimezone(task.dueAt, ctx.company.timezone) : "—"}</p></div>)}</Panel>
    {d.finance ? <Panel title={t("overBudget")}>{d.finance.overBudget.map((p) => <div className="construction-item" key={p.id}><Link href={`/${locale}/projects/${p.id}?tab=budget`}>{p.name}</Link><p>{formatMoney(p.actual - p.plan!, p.currency, locale)}</p></div>)}</Panel> : null}
  </div>;
}
