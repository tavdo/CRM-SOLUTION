import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge, EmptyState, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listTasks } from "@/lib/services/tasks";
import { formatDateTime, isTaskOverdue } from "@/lib/dates";
import { isLocale } from "@/i18n/config";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ overdue?: string; status?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("tasks");
  const tasks = await listTasks(ctx, {
    overdue: sp.overdue === "1",
    status: sp.status === "DONE" || sp.status === "OPEN" ? sp.status : undefined,
  });

  const activeFilter =
    sp.overdue === "1" ? "overdue" : sp.status === "OPEN" ? "open" : sp.status === "DONE" ? "done" : "all";

  return (
    <div style={{ display: "grid", gap: "1.15rem" }}>
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
        <Link href={`/${locale}/tasks/new`} className="btn btn-primary">
          <Plus size={15} />
          <span>{t("new")}</span>
        </Link>
      </div>

      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
        <Link
          href={`/${locale}/tasks`}
          className={`btn ${activeFilter === "all" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("filterAll")}
        </Link>
        <Link
          href={`/${locale}/tasks?overdue=1`}
          className={`btn ${activeFilter === "overdue" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("filterOverdue")}
        </Link>
        <Link
          href={`/${locale}/tasks?status=OPEN`}
          className={`btn ${activeFilter === "open" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("open")}
        </Link>
        <Link
          href={`/${locale}/tasks?status=DONE`}
          className={`btn ${activeFilter === "done" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("done")}
        </Link>
      </div>

      <Surface style={{ overflowX: "auto" }}>
        {tasks.length === 0 ? (
          <EmptyState>{t("empty")}</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("taskTitle")}</th>
                <th>{t("owner")}</th>
                <th>{t("due")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const overdue = isTaskOverdue(task.status, task.dueAt);
                return (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/${locale}/tasks/${task.id}`}>
                        <strong style={{ color: "#fff" }}>{task.title}</strong>
                      </Link>
                      {task.deal ? (
                        <div className="muted" style={{ fontSize: "0.78rem" }}>
                          {task.deal.title}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted">{task.owner.name}</td>
                    <td>
                      <span className="muted">
                        {formatDateTime(task.dueAt, locale, ctx.company.timezone)}
                      </span>
                      {overdue ? (
                        <>
                          {" "}
                          <Badge tone="danger">{t("overdue")}</Badge>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={task.status === "DONE" ? "ok" : "default"}>
                        {task.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Surface>
    </div>
  );
}
