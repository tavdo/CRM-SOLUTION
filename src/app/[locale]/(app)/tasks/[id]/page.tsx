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

  let task;
  try {
    task = await getTask(ctx, id);
  } catch (err) {
    if (isAppError(err) && err.status === 404) notFound();
    throw err;
  }

  const overdue = isTaskOverdue(task.status, task.dueAt);

  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/${locale}/tasks`}>{t("title")}</Link>
        </p>
        <h1 className="page-title">{task.title}</h1>
        <Badge tone={task.status === "DONE" ? "ok" : overdue ? "danger" : "default"}>
          {overdue ? t("overdue") : task.status}
        </Badge>
      </div>

      <Surface style={{ padding: "1.2rem" }}>
        <p>{task.description || "—"}</p>
        <p className="muted">
          {t("owner")}: {task.owner.name}
          <br />
          {t("due")}: {formatDateTime(task.dueAt, locale, ctx.company.timezone)}
          <br />
          {task.customer ? (
            <>
              {t("linkedCustomer")}:{" "}
              <Link href={`/${locale}/customers/${task.customer.id}`}>{task.customer.name}</Link>
              <br />
            </>
          ) : null}
          {task.deal ? (
            <>
              {t("linkedDeal")}: <Link href={`/${locale}/deals/${task.deal.id}`}>{task.deal.title}</Link>
            </>
          ) : null}
        </p>

        {task.status === "OPEN" ? (
          <form action={completeTaskAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={task.id} />
            <Button type="submit">{t("complete")}</Button>
          </form>
        ) : (
          <form action={reopenTaskAction}>
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
