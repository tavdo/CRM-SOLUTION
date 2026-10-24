import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { CalendarDays, CheckSquare, Kanban, Plane, Plus } from "lucide-react";
import { Badge, EmptyState, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, isTaskOverdue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isLocale } from "@/i18n/config";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";

  const [tasks, deals, leaves] = await Promise.all([
    prisma.task.findMany({
      where: { companyId: ctx.company.id, dueAt: { not: null } },
      include: { owner: { select: { name: true } }, deal: { select: { title: true } } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.deal.findMany({
      where: {
        companyId: ctx.company.id,
        archivedAt: null,
        expectedCloseAt: { not: null },
      },
      include: { owner: { select: { name: true } }, stage: true },
      orderBy: { expectedCloseAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { companyId: ctx.company.id },
      include: { user: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return (
    <div style={{ display: "grid", gap: "1.35rem" }}>
      <div
        className="rise"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">
            {isKa ? "განრიგი · შეხვედრები, დედლაინები და შვებულებები" : "UNIFIED SCHEDULE · TASKS, DEALS & TEAM ABSENCES"}
          </span>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {isKa ? "კომპანიის კალენდარი (Bitrix24 Calendar)" : "Company Calendar & Timeline"}
          </h1>
        </div>
        <Link href={`/${locale}/tasks/new`} className="btn btn-primary">
          <Plus size={15} />
          <span>{isKa ? "ახალი შეხვედრა / დავალება" : "Schedule Task / Call"}</span>
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1.1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
          alignItems: "start",
        }}
      >
        {/* Tasks & Calls */}
        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
            <CheckSquare size={16} color="#10b981" />
            <h2 className="section-title">
              {isKa ? "დაგეგმილი ზარები და დავალებები" : "Scheduled Tasks & Calls"}
            </h2>
          </div>
          {tasks.length === 0 ? (
            <EmptyState>{isKa ? "დაგეგმილი დავალებები არ არის." : "No scheduled tasks."}</EmptyState>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.55rem" }}>
              {tasks.map((task) => {
                const overdue = isTaskOverdue(task.status, task.dueAt);
                return (
                  <li
                    key={task.id}
                    style={{
                      padding: "0.75rem",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <Link href={`/${locale}/tasks/${task.id}`}>
                        <strong style={{ color: "#fff", fontSize: "0.88rem" }}>{task.title}</strong>
                      </Link>
                      <Badge tone={task.status === "DONE" ? "ok" : overdue ? "danger" : "default"}>
                        {overdue ? (isKa ? "ვადაგადაცილებული" : "OVERDUE") : task.status}
                      </Badge>
                    </div>
                    <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                      <CalendarDays size={12} style={{ display: "inline", marginRight: 4 }} />
                      {formatDateTime(task.dueAt, locale, ctx.company.timezone)} · {task.owner.name}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>

        {/* Expected Deal Closings */}
        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
            <Kanban size={16} color="#38bdf8" />
            <h2 className="section-title">
              {isKa ? "გარიგებების დახურვის კალენდარი" : "Expected Deal Closings"}
            </h2>
          </div>
          {deals.length === 0 ? (
            <EmptyState>{isKa ? "თარიღიანი გარიგებები არ არის." : "No deal close dates set."}</EmptyState>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.55rem" }}>
              {deals.map((d) => (
                <li
                  key={d.id}
                  style={{
                    padding: "0.75rem",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <Link href={`/${locale}/deals/${d.id}`}>
                      <strong style={{ color: "#fff", fontSize: "0.88rem" }}>{d.title}</strong>
                    </Link>
                    <Badge tone={d.status === "WON" ? "ok" : "default"}>{d.stage.name}</Badge>
                  </div>
                  <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: "0.84rem", marginTop: 4 }}>
                    {formatMoney(d.amountMinor, d.currency, locale)}
                  </div>
                  <div className="muted" style={{ fontSize: "0.76rem", marginTop: 2 }}>
                    {formatDate(d.expectedCloseAt, locale, ctx.company.timezone)} · {d.owner?.name ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        {/* Employee Absences / Vacation Calendar */}
        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
            <Plane size={16} color="#f59e0b" />
            <h2 className="section-title">
              {isKa ? "თანამშრომლების შვებულებები / არყოფნა" : "Team Absence & Leave Calendar"}
            </h2>
          </div>
          {leaves.length === 0 ? (
            <EmptyState>{isKa ? "შვებულებები დაფიქსირებული არ არის." : "No leave entries."}</EmptyState>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.55rem" }}>
              {leaves.map((l) => (
                <li
                  key={l.id}
                  style={{
                    padding: "0.75rem",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ color: "#fff", fontSize: "0.88rem" }}>{l.user.name}</strong>
                    <Badge tone={l.status === "APPROVED" ? "ok" : "warn"}>{l.leaveType}</Badge>
                  </div>
                  <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                    {formatDate(l.startDate, locale, ctx.company.timezone)} →{" "}
                    {formatDate(l.endDate, locale, ctx.company.timezone)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  );
}
