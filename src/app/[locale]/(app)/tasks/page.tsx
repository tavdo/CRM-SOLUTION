import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus, LayoutGrid, List } from "lucide-react";
import { Badge, Button, EmptyState, Surface } from "@/components/ui";
import { moveTaskStageAction } from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listTasks } from "@/lib/services/tasks";
import { formatDateTime, isTaskOverdue } from "@/lib/dates";
import { isLocale } from "@/i18n/config";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ overdue?: string; status?: string; view?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("tasks");
  const isKa = locale === "ka";
  const view = sp.view === "list" ? "list" : "board";

  const tasks = await listTasks(ctx, {
    overdue: sp.overdue === "1",
    status: sp.status === "DONE" || sp.status === "OPEN" ? sp.status : undefined,
  });

  const activeFilter =
    sp.overdue === "1" ? "overdue" : sp.status === "OPEN" ? "open" : sp.status === "DONE" ? "done" : "all";

  const columns = [
    { key: "TODO", label: isKa ? "შესასრულებელი (To Do)" : "To Do" },
    { key: "IN_PROGRESS", label: isKa ? "პროცესშია (In Progress)" : "In Progress" },
    { key: "REVIEW", label: isKa ? "შემოწმებაზე (Review)" : "In Review" },
    { key: "DONE", label: isKa ? "დასრულებული (Done)" : "Completed" },
  ];

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
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link
            href={`/${locale}/tasks?view=board`}
            className={`btn ${view === "board" ? "btn-primary" : "btn-secondary"}`}
          >
            <LayoutGrid size={15} />
            <span>{isKa ? "დაფა (Kanban)" : "Kanban Board"}</span>
          </Link>
          <Link
            href={`/${locale}/tasks?view=list`}
            className={`btn ${view === "list" ? "btn-primary" : "btn-secondary"}`}
          >
            <List size={15} />
            <span>{isKa ? "სია (List)" : "List View"}</span>
          </Link>
          <Link href={`/${locale}/tasks/new`} className="btn btn-primary">
            <Plus size={15} />
            <span>{t("new")}</span>
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
        <Link
          href={`/${locale}/tasks?view=${view}`}
          className={`btn ${activeFilter === "all" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("filterAll")}
        </Link>
        <Link
          href={`/${locale}/tasks?overdue=1&view=${view}`}
          className={`btn ${activeFilter === "overdue" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("filterOverdue")}
        </Link>
        <Link
          href={`/${locale}/tasks?status=OPEN&view=${view}`}
          className={`btn ${activeFilter === "open" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("open")}
        </Link>
        <Link
          href={`/${locale}/tasks?status=DONE&view=${view}`}
          className={`btn ${activeFilter === "done" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("done")}
        </Link>
      </div>

      {tasks.length === 0 ? (
        <Surface>
          <EmptyState>{t("empty")}</EmptyState>
        </Surface>
      ) : view === "board" ? (
        <div className="pipeline" role="list">
          {columns.map((col) => {
            const colTasks = tasks.filter((task) => {
              const stage =
                task.status === "DONE" ? "DONE" : task.boardStage || "TODO";
              return stage === col.key;
            });
            return (
              <section key={col.key} className="pipeline-col" role="listitem">
                <div className="pipeline-col-header">
                  <strong style={{ fontSize: "0.88rem", color: "#fff" }}>{col.label}</strong>
                  <Badge tone={col.key === "DONE" ? "ok" : "default"}>
                    {colTasks.length}
                  </Badge>
                </div>

                {colTasks.map((task) => {
                  const overdue = isTaskOverdue(task.status, task.dueAt);
                  return (
                    <div key={task.id} className="pipeline-card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <Badge
                          tone={
                            task.priority === "URGENT" || overdue
                              ? "danger"
                              : task.priority === "HIGH"
                                ? "warn"
                                : "default"
                          }
                        >
                          {overdue ? t("overdue") : task.priority}
                        </Badge>
                        <span className="muted" style={{ fontSize: "0.72rem" }}>
                          {task.owner.name}
                        </span>
                      </div>
                      <Link
                        href={`/${locale}/tasks/${task.id}`}
                        style={{ display: "block", marginTop: 8 }}
                      >
                        <strong style={{ color: "#fff", fontSize: "0.9rem" }}>{task.title}</strong>
                      </Link>
                      {task.deal ? (
                        <div className="muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
                          {task.deal.title}
                        </div>
                      ) : null}
                      <div className="muted" style={{ fontSize: "0.74rem", marginTop: 6 }}>
                        {formatDateTime(task.dueAt, locale, ctx.company.timezone)}
                      </div>

                      <form
                        action={moveTaskStageAction}
                        style={{ display: "flex", gap: 6, marginTop: 8 }}
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={task.id} />
                        <select
                          name="boardStage"
                          className="select"
                          defaultValue={task.status === "DONE" ? "DONE" : task.boardStage || "TODO"}
                          style={{ padding: "0.35rem 0.55rem", fontSize: "0.76rem" }}
                        >
                          {columns.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="submit"
                          variant="secondary"
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                        >
                          →
                        </Button>
                      </form>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : (
        <Surface style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("taskTitle")}</th>
                <th>Priority</th>
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
                    <td>
                      <Badge
                        tone={
                          task.priority === "URGENT"
                            ? "danger"
                            : task.priority === "HIGH"
                              ? "warn"
                              : "default"
                        }
                      >
                        {task.priority}
                      </Badge>
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
        </Surface>
      )}
    </div>
  );
}
