import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { Badge, EmptyState, Surface } from "@/components/ui";
import { DealPipelineBoard } from "@/components/DealPipelineBoard";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listDeals, listStages } from "@/lib/services/deals";
import { formatMoney, sumByCurrency } from "@/lib/money";
import { isLocale } from "@/i18n/config";

export default async function DealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; q?: string; status?: string; stage?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const status = sp.status === "OPEN" || sp.status === "WON" || sp.status === "LOST" ? sp.status : undefined;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 120) : "";
  const stageId = typeof sp.stage === "string" ? sp.stage.slice(0, 100) : undefined;
  const [stages, deals] = await Promise.all([listStages(ctx), listDeals(ctx, { status, q: query, stageId })]);
  const t = await getTranslations("deals");
  const ui = await getTranslations("workspaceUi");
  const view = sp.view === "list" ? "list" : "board";
  const viewHref = (next: string) => {
    const queryParams = new URLSearchParams({ view: next });
    if (query) queryParams.set("q", query);
    if (status) queryParams.set("status", status);
    if (stageId) queryParams.set("stage", stageId);
    return `/${locale}/deals?${queryParams.toString()}`;
  };

  const orderedStages = stages
    .filter((s) => !s.isWon && !s.isLost)
    .concat(stages.filter((s) => s.isWon || s.isLost));

  const boardStages = orderedStages.map((stage) => {
    const columnDeals = deals.filter((d) => d.stageId === stage.id);
    const totals = Object.entries(sumByCurrency(columnDeals));
    return {
      id: stage.id,
      name: stage.name,
      isWon: stage.isWon,
      isLost: stage.isLost,
      totalLabel:
        totals.length > 0
          ? totals.map(([c, m]) => formatMoney(m, c, locale)).join(" · ")
          : null,
      deals: columnDeals.map((d) => ({
        id: d.id,
        title: d.title,
        stageId: d.stageId,
        amountLabel: formatMoney(d.amountMinor, d.currency, locale),
        customerName: d.customer?.name ?? "—",
        ownerName: d.owner?.name ?? "—",
      })),
    };
  });

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      <div>
        <div className="sales-toolbar">
          <h1 className="page-title">{t("title")}</h1>
          <Link href={`/${locale}/deals/new`} className="btn btn-primary"><Plus size={17} />{ui("create")}</Link>
          <form className="sales-filter" action={`/${locale}/deals`}>
            <input type="hidden" name="view" value={view} />
            <label htmlFor="deal-query" className="sr-only">{ui("searchDeals")}</label>
            <input id="deal-query" className="input" name="q" maxLength={120} defaultValue={query} placeholder={ui("searchPlaceholder")} />
            <label htmlFor="deal-stage" className="sr-only">{t("stage")}</label>
            <select id="deal-stage" className="select" name="stage" defaultValue={stageId || ""}>
              <option value="">{ui("allStages")}</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
            <label htmlFor="deal-status" className="sr-only">{t("status")}</label>
            <select id="deal-status" className="select" name="status" defaultValue={status || ""}><option value="">{ui("allStatuses")}</option>{["OPEN", "WON", "LOST"].map((value) => <option key={value} value={value}>{ui(`dealStatus.${value}`)}</option>)}</select>
            <button className="btn btn-primary" type="submit"><Search size={15} />{ui("filter")}</button>
            {(query || status || stageId) && <Link className="btn btn-secondary" href={`/${locale}/deals?view=${view}`} aria-label={ui("clearFilters")}><X size={16} />{ui("clear")}</Link>}
          </form>
        </div>
        <div className="workspace-viewbar"><nav className="workspace-view-tabs" aria-label={ui("viewMode")}>
          <Link href={viewHref("board")} aria-current={view === "board" ? "page" : undefined}><LayoutGrid size={14} />{t("board")}</Link>
          <Link href={viewHref("list")} aria-current={view === "list" ? "page" : undefined}><List size={14} />{t("list")}</Link>
        </nav><span className="workspace-result-count">{ui("resultCount", { count: deals.length })}</span></div>
      </div>

      {deals.length === 0 ? (
        <Surface>
          <EmptyState>{query || status || stageId ? ui("noResults") : t("empty")}</EmptyState>
        </Surface>
      ) : view === "list" ? (
        <Surface style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("dealTitle")}</th>
                <th>{t("customer")}</th>
                <th>{t("stage")}</th>
                <th>{t("amount")}</th>
                <th>{t("owner")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/${locale}/deals/${d.id}`}>
                      <strong style={{ color: "var(--ink)" }}>{d.title}</strong>
                    </Link>
                  </td>
                  <td className="muted">{d.customer?.name ?? "—"}</td>
                  <td>
                    <Badge>{d.stage.name}</Badge>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {formatMoney(d.amountMinor, d.currency, locale)}
                  </td>
                  <td className="muted">{d.owner?.name ?? "—"}</td>
                  <td>
                    <Badge
                      tone={
                        d.status === "WON" ? "ok" : d.status === "LOST" ? "danger" : "default"
                      }
                    >
                      {ui(`dealStatus.${d.status}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      ) : (
        <DealPipelineBoard locale={locale} stages={boardStages} />
      )}
    </div>
  );
}
