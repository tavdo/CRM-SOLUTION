import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { completeTaskAction, reopenTaskAction } from "@/app/actions/crm";
import { Badge, Button, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getTask } from "@/lib/services/tasks";
import { formatDateTime, isTaskOverdue } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { isLocale } from "@/i18n/config";
import styles from "@/components/WorkspaceForm.module.css";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("tasks");
  const c = await getTranslations("construction");

  let task;
  try {
    task = await getTask(ctx, id);
  } catch (err) {
    if (isAppError(err) && err.status === 404) notFound();
    throw err;
  }

  const overdue = isTaskOverdue(task.status, task.dueAt);

  return (
    <div className={styles.page}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/${locale}/tasks`}>{t("title")}</Link>
        </p>
        <h1 className="page-title">{task.title}</h1>
        <Badge tone={task.status === "DONE" ? "ok" : overdue ? "danger" : "default"}>
          {overdue ? t("overdue") : task.status}
        </Badge>
      </div>

      <Surface className={styles.panel}>
        <p style={{ marginTop: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{task.description || "—"}</p>
        <dl className="construction-facts" style={{ overflowWrap: "anywhere" }}>
          <div>
            <dt>{t("owner")}</dt>
            <dd>{task.owner.name}</dd>
          </div>
          <div>
            <dt>{t("due")}</dt>
            <dd>{formatDateTime(task.dueAt, locale, ctx.company.timezone)}</dd>
          </div>
          {task.customer ? (
            <div>
              <dt>{t("linkedCustomer")}</dt>
              <dd><Link href={`/${locale}/customers/${task.customer.id}`}>{task.customer.name}</Link></dd>
            </div>
          ) : null}
          {task.deal ? (
            <div>
              <dt>{t("linkedDeal")}</dt>
              <dd><Link href={`/${locale}/deals/${task.deal.id}`}>{task.deal.title}</Link></dd>
            </div>
          ) : null}
        </dl>

        {task.projectId ? <div className={styles.actions}><Link className="btn btn-primary" href={`/${locale}/projects/${task.projectId}?tab=work`}>{c("reports")}</Link></div> : task.status === "OPEN" ? (
          <form action={completeTaskAction} className={styles.actions}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={task.id} />
            <Button type="submit">{t("complete")}</Button>
          </form>
        ) : (
          <form action={reopenTaskAction} className={styles.actions}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={task.id} />
            <Button type="submit" variant="secondary">
              {t("reopen")}
            </Button>
          </form>
        )}
      </Surface>
    </div>
  );
}
