import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Briefcase,
  TrendingUp,
  CheckSquare,
  Award,
  AlertTriangle,
  Clock,
  Building,
  ArrowUpRight,
} from "lucide-react";
import { Badge, EmptyState, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getDashboard } from "@/lib/services/dashboard";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { isLocale } from "@/i18n/config";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const data = await getDashboard(ctx);
  const t = await getTranslations("dashboard");

  const pipelineEntries = Object.entries(data.pipelineValueByCurrency);

  return (
    <div style={{ display: "grid", gap: "1.4rem" }}>
      <div
        className="rise"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">{ctx.company.name}</span>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {t("title")}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Badge tone="ok">{ctx.role}</Badge>
          <Badge>{ctx.company.currency}</Badge>
        </div>
      </div>

      <div className="grid-stats rise rise-delay-1">
        <Surface className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>{t("activeDeals")}</span>
            <Briefcase size={16} color="#10b981" />
          </div>
          <strong>{data.activeDealsCount}</strong>
        </Surface>

        <Surface className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>{t("pipelineValue")}</span>
            <TrendingUp size={16} color="#38bdf8" />
          </div>
          <strong style={{ fontSize: "1.3rem", lineHeight: 1.35 }}>
            {pipelineEntries.length === 0
              ? "—"
              : pipelineEntries
                  .map(([cur, minor]) => formatMoney(minor, cur, locale))
                  .join(" · ")}
          </strong>
        </Surface>

        <Surface className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>{t("openTasks")}</span>
            <CheckSquare size={16} color="#f59e0b" />
          </div>
          <strong>{data.openTasksCount}</strong>
        </Surface>

        <Surface className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>{t("wonMonth")}</span>
            <Award size={16} color="#10b981" />
          </div>
          <strong>{data.wonThisMonth}</strong>
        </Surface>
      </div>

      <div
        className="grid-stats rise rise-delay-1"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
      >
        <Surface className="stat-card">
          <span className="muted" style={{ fontSize: "0.8rem" }}>{t("lostMonth")}</span>
          <strong style={{ color: "var(--danger-ink)" }}>{data.lostThisMonth}</strong>
        </Surface>
        <Surface className="stat-card">
          <span className="muted" style={{ fontSize: "0.8rem" }}>{t("winRate")}</span>
          <strong>{data.winRate == null ? "—" : `${data.winRate}%`}</strong>
        </Surface>
        <Surface className="stat-card">
          <span className="muted" style={{ fontSize: "0.8rem" }}>{t("overdue")}</span>
          <strong style={{ color: data.overdueCount > 0 ? "#fda4af" : undefined }}>
            {data.overdueCount}
          </strong>
        </Surface>
      </div>

      <Surface className="rise rise-delay-2" style={{ padding: "1.2rem" }}>
        <h2 className="section-title" style={{ marginBottom: "0.85rem" }}>
          {t("funnel")}
        </h2>
        {data.funnel.length === 0 ? (
          <EmptyState>{t("empty")}</EmptyState>
        ) : (
          <div className="funnel-bars">
            {(() => {
              const max = Math.max(1, ...data.funnel.map((f) => f.count));
              return data.funnel.map((f) => (
                <div key={f.stageId} className="funnel-row">
                  <span style={{ fontSize: "0.82rem", color: "var(--ink)" }}>{f.name}</span>
                  <div className="funnel-track">
                    <div
                      className="funnel-fill"
                      style={{
                        width: `${Math.round((f.count / max) * 100)}%`,
                        background: f.isWon
                          ? "linear-gradient(90deg,#059669,#34d399)"
                          : f.isLost
                            ? "linear-gradient(90deg,#be123c,#fb7185)"
                            : undefined,
                      }}
                    />
                  </div>
                  <strong style={{ fontSize: "0.85rem", minWidth: 28, textAlign: "right" }}>
                    {f.count}
                  </strong>
                </div>
              ));
            })()}
          </div>
        )}
      </Surface>

      <div
        className="rise rise-delay-2"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        }}
      >
        <Surface style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} color="#f43f5e" />
              <h2 className="section-title">{t("overdue")}</h2>
            </div>
            <Badge tone={data.overdueTasks.length > 0 ? "danger" : "default"}>
              {data.overdueTasks.length}
            </Badge>
          </div>
          {data.overdueTasks.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
              {data.overdueTasks.map((task) => (
                <li
                  key={task.id}
                  style={{
                    padding: "0.65rem 0.75rem",
                    borderRadius: 10,
                    background: "rgba(244, 63, 94, 0.06)",
                    border: "1px solid rgba(244, 63, 94, 0.2)",
                  }}
                >
                  <Link
                    href={`/${locale}/tasks/${task.id}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <strong style={{ fontSize: "0.88rem" }}>{task.title}</strong>
                    <ArrowUpRight size={14} className="muted" />
                  </Link>
                  <div className="muted" style={{ fontSize: "0.78rem", marginTop: 3 }}>
                    {task.owner.name} · {formatDateTime(task.dueAt, locale, ctx.company.timezone)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color="#38bdf8" />
              <h2 className="section-title">{t("upcoming")}</h2>
            </div>
            <Badge>{data.upcomingTasks.length}</Badge>
          </div>
          {data.upcomingTasks.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
              {data.upcomingTasks.map((task) => (
                <li
                  key={task.id}
                  style={{
                    padding: "0.65rem 0.75rem",
                    borderRadius: 10,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Link
                    href={`/${locale}/tasks/${task.id}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <strong style={{ fontSize: "0.88rem" }}>{task.title}</strong>
                    <ArrowUpRight size={14} className="muted" />
                  </Link>
                  <div className="muted" style={{ fontSize: "0.78rem", marginTop: 3 }}>
                    {formatDateTime(task.dueAt, locale, ctx.company.timezone)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building size={16} color="#10b981" />
              <h2 className="section-title">{t("recentCustomers")}</h2>
            </div>
            <Link href={`/${locale}/customers`} className="muted" style={{ fontSize: "0.78rem" }}>
              →
            </Link>
          </div>
          {data.recentCustomers.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
              {data.recentCustomers.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: "0.65rem 0.75rem",
                    borderRadius: 10,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Link
                    href={`/${locale}/customers/${c.id}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <strong style={{ fontSize: "0.88rem" }}>{c.name}</strong>
                    <ArrowUpRight size={14} className="muted" />
                  </Link>
                  {c.email ? (
                    <div className="muted" style={{ fontSize: "0.76rem", marginTop: 2 }}>
                      {c.email}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      <Surface style={{ padding: "0.85rem 1.15rem" }}>
        <details className="muted" style={{ fontSize: "0.8rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink-secondary)" }}>
            {t("definitions")}
          </summary>
          <ul style={{ marginTop: "0.55rem", marginBottom: 0, paddingLeft: "1.2rem" }}>
            {Object.entries(data.definitions).map(([k, v]) => (
              <li key={k}>
                <strong style={{ color: "var(--ink)" }}>{k}:</strong> {v}
              </li>
            ))}
          </ul>
        </details>
      </Surface>
    </div>
  );
}
