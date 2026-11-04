import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, CalendarDays, CheckSquare, Circle, Inbox, Kanban, Plus, Users, Wallet } from "lucide-react";
import type { CSSProperties } from "react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getCrmOverview } from "@/lib/services/crm-overview";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { Badge, EmptyState, Surface } from "@/components/ui";

const stageColors = ["#0000e2", "#0003d4", "#00008b", "#000175", "#00025f", "#3b51ef"];

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const [t, nav, d] = await Promise.all([getTranslations("workspaceUi"), getTranslations("nav"), getCrmOverview(ctx)]);
  const now = new Date();
  const currencyValues = Object.entries(d.pipelineValue);
  const money = currencyValues.length ? currencyValues.map(([currency, minor]) => formatMoney(minor, currency, locale)) : [formatMoney(0, ctx.company.currency, locale)];
  const metrics = [
    { label: t("activeDeals"), value: String(d.activeDeals), note: t("openDealsNote"), icon: Kanban, color: "var(--chart-1)", href: "deals?status=OPEN" },
    { label: t("pipelineValue"), value: money, note: t("currencyNote"), icon: Wallet, color: "var(--chart-2)", href: "deals?status=OPEN", money: true },
    { label: t("newLeads"), value: String(d.newLeads), note: t("leadsNote"), icon: Inbox, color: "var(--chart-3)", href: "leads?status=NEW" },
    { label: t("openTasks"), value: String(d.openTasks), note: t("overdueCount", { count: d.overdueTasks }), icon: CheckSquare, color: "var(--chart-4)", href: "tasks?status=OPEN" },
  ];
  const panelHeader = (title: string, path: string) => <div className="overview-panel-header"><h2>{title}</h2><Link href={`/${locale}/${path}`}>{t("viewAll")}<ArrowUpRight size={14} /></Link></div>;
  return <div>
    <div className="workspace-page-heading">
      <div><h1 className="page-title">{t("overview")}</h1><p>{t("overviewIntro", { name: ctx.user.name.split(" ")[0] })}</p></div>
      <div className="workspace-heading-actions"><span className="workspace-date"><CalendarDays size={16} />{formatDate(now, locale, ctx.company.timezone)}</span>
        <Link href={`/${locale}/deals/new`} className="btn btn-primary"><Plus size={17} />{t("createDeal")}</Link></div>
    </div>
    <div className="overview-kpis">{metrics.map((metric) => <Link key={metric.href + metric.label} href={`/${locale}/${metric.href}`}>
      <Surface className={`overview-kpi ${metric.money ? "overview-kpi-money" : ""}`} style={{ "--metric-color": metric.color, height: "100%" } as CSSProperties}>
        <div className="overview-kpi-label"><span>{metric.label}</span><metric.icon size={21} /></div>
        <div className="overview-kpi-value">{Array.isArray(metric.value) ? metric.value.map((value) => <div key={value}>{value}</div>) : metric.value}</div>
        <div className="overview-kpi-note">{metric.note}</div>
      </Surface></Link>)}</div>
    <div className="overview-columns">
      <div className="overview-stack">
        <Surface className="overview-panel">{panelHeader(t("salesPipeline"), "deals")}
          {d.stages.length ? <div className="overview-pipeline">{d.stages.map((stage, index) => <Link key={stage.id} className="overview-stage" href={`/${locale}/deals?status=OPEN&stage=${encodeURIComponent(stage.id)}`} style={{ "--stage-color": stageColors[index % stageColors.length] } as CSSProperties}>
            <div className="overview-stage-bar">{stage.count}</div><div className="overview-stage-name">{stage.name}</div>
          </Link>)}</div> : <EmptyState>{t("emptyPipeline")}</EmptyState>}
          <div className="overview-pipeline-summary"><span>{t("won")}<strong>{d.won}</strong></span><span>{t("lost")}<strong>{d.lost}</strong></span><span>{t("winRate")}<strong>{d.winRate === null ? "—" : `${d.winRate}%`}</strong></span></div>
        </Surface>
        <Surface className="overview-panel">{panelHeader(t("recentDeals"), "deals?view=list")}
          {d.recentDeals.length ? <div className="overview-table-wrap"><table className="table"><thead><tr><th>{t("dealName")}</th><th>{t("amount")}</th><th>{t("status")}</th></tr></thead>
            <tbody>{d.recentDeals.map((deal) => <tr key={deal.id}><td><Link href={`/${locale}/deals/${deal.id}`}>{deal.title}</Link></td><td>{formatMoney(deal.amountMinor, deal.currency, locale)}</td><td><Badge tone={deal.status === "WON" ? "ok" : deal.status === "LOST" ? "warn" : "default"}>{t(`dealStatus.${deal.status}`)}</Badge></td></tr>)}</tbody></table></div> : <EmptyState>{t("emptyDeals")}</EmptyState>}
        </Surface>
        <Surface className="overview-panel">{panelHeader(t("recentCustomers"), "customers")}
          {d.recentCustomers.length ? <div className="overview-table-wrap"><table className="table"><thead><tr><th>{nav("customers")}</th><th>{t("addedOn")}</th></tr></thead><tbody>{d.recentCustomers.map((customer) => <tr key={customer.id}><td><Link href={`/${locale}/customers/${customer.id}`}>{customer.name}</Link></td><td className="muted">{formatDate(customer.createdAt, locale, ctx.company.timezone)}</td></tr>)}</tbody></table></div> : <EmptyState>{t("emptyCustomers")}</EmptyState>}
        </Surface>
      </div>
      <div className="overview-stack overview-secondary">
        <Surface className="overview-panel">{panelHeader(t("taskAgenda"), "tasks")}
          {d.upcomingTasks.length ? <div className="overview-task-list">{d.upcomingTasks.map((task) => <div className="overview-task" key={task.id}><Circle size={16} /><div className="overview-task-body"><Link href={`/${locale}/tasks/${task.id}`}>{task.title}</Link><p>{task.owner.name}</p><p><span className={`overview-task-date ${task.dueAt && task.dueAt < now ? "overdue" : ""}`}>{task.dueAt ? formatDate(task.dueAt, locale, ctx.company.timezone) : t("noDueDate")}</span></p></div></div>)}</div> : <EmptyState>{t("emptyTasks")}</EmptyState>}
        </Surface>
        <Surface className="overview-panel">{panelHeader(t("leadSources"), "leads")}
          {d.sources.length ? <div className="overview-source-list">{d.sources.map((source) => <div className="overview-source" key={source.source}><div><span>{t.has(`sources.${source.source}`) ? t(`sources.${source.source}`) : source.source}</span><strong>{source.count}</strong></div><div className="overview-source-track"><span style={{ width: `${source.count / d.totalLeads * 100}%` }} /></div></div>)}</div> : <EmptyState>{t("emptyLeads")}</EmptyState>}
        </Surface>
        <Surface className="overview-panel"><div className="overview-panel-header"><h2>{t("quickActions")}</h2></div><div className="overview-shortcuts">
          <Link href={`/${locale}/customers/new`}><Users size={22} />{t("createCustomer")}</Link>
          <Link href={`/${locale}/tasks/new`}><CheckSquare size={22} />{t("createTask")}</Link>
          <Link href={`/${locale}/calendar`}><CalendarDays size={22} />{nav("calendar")}</Link>
          <Link href={`/${locale}/${can(ctx.role, "company.members") ? "settings#members" : "deals/new"}`}><Plus size={22} />{can(ctx.role, "company.members") ? t("invite") : t("createDeal")}</Link>
        </div></Surface>
      </div>
    </div>
    <p className="overview-scope-note">{t("scopeNote")}</p>
  </div>;
}
