import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Badge, EmptyState, Surface } from "@/components/ui";
import { MoveDealSelect } from "@/components/MoveDealSelect";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listDeals, listStages } from "@/lib/services/deals";
import { formatMoney, sumByCurrency } from "@/lib/money";
import { isLocale } from "@/i18n/config";

export default async function DealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const [stages, deals] = await Promise.all([listStages(ctx), listDeals(ctx)]);
  const t = await getTranslations("deals");
  const view = sp.view === "list" ? "list" : "board";

  const orderedStages = stages
    .filter((s) => !s.isWon && !s.isLost)
    .concat(stages.filter((s) => s.isWon || s.isLost));

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">{ctx.company.name}</span>
          <h1 className="page-title" style={{ marginTop: 2 }}>
            {t("title")}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link
            href={`/${locale}/deals?view=board`}
            className={`btn ${view === "board" ? "btn-primary" : "btn-secondary"}`}
          >
            <LayoutGrid size={15} />
            <span>{t("board")}</span>
          </Link>
          <Link
            href={`/${locale}/deals?view=list`}
            className={`btn ${view === "list" ? "btn-primary" : "btn-secondary"}`}
          >
            <List size={15} />
            <span>{t("list")}</span>
          </Link>
          <Link href={`/${locale}/deals/new`} className="btn btn-primary">
            <Plus size={15} />
            <span>{t("new")}</span>
          </Link>
        </div>
      </div>

      {deals.length === 0 ? (
        <Surface>
          <EmptyState>{t("empty")}</EmptyState>
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
                      <strong style={{ color: "#fff" }}>{d.title}</strong>
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
                      {d.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      ) : (
        <div className="pipeline" role="list">
          {orderedStages.map((stage) => {
            const columnDeals = deals.filter((d) => d.stageId === stage.id);
            const totals = Object.entries(sumByCurrency(columnDeals));
            return (
              <section
                key={stage.id}
                className="pipeline-col"
                aria-label={stage.name}
                role="listitem"
              >
                <div className="pipeline-col-header">
                  <div>
                    <strong style={{ fontSize: "0.88rem", color: "#fff" }}>{stage.name}</strong>
                    {totals.length > 0 ? (
                      <div className="muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                        {totals.map(([c, m]) => formatMoney(m, c, locale)).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <Badge
                    tone={stage.isWon ? "ok" : stage.isLost ? "danger" : "default"}
                  >
                    {columnDeals.length}
                  </Badge>
                </div>

                {columnDeals.map((d) => (
                  <div key={d.id} className="pipeline-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "flex-start" }}>
                      <Link href={`/${locale}/deals/${d.id}`}>
                        <strong style={{ color: "#fff", fontSize: "0.9rem" }}>{d.title}</strong>
                      </Link>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        color: "var(--brand)",
                        marginTop: 6,
                      }}
                    >
                      {formatMoney(d.amountMinor, d.currency, locale)}
                    </div>
                    <div className="muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
                      {d.customer?.name ?? "—"} · {d.owner?.name ?? "—"}
                    </div>
                    <MoveDealSelect
                      locale={locale}
                      dealId={d.id}
                      stageId={d.stageId}
                      stages={stages.map((s) => ({ id: s.id, name: s.name }))}
                      label={t("move")}
                    />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
