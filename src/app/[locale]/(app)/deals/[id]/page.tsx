import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { closeDealAction, createTaskAction, updateDealAction } from "@/app/actions/crm";
import { Badge, Button, Field, Input, Surface } from "@/components/ui";
import { MoveDealSelect } from "@/components/MoveDealSelect";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getDeal, listStages } from "@/lib/services/deals";
import { formatMoney, fromMinor } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { isLocale } from "@/i18n/config";
import { isTaskOverdue } from "@/lib/dates";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("deals");
  const tasksT = await getTranslations("tasks");

  let deal;
  try {
    deal = await getDeal(ctx, id);
  } catch (err) {
    if (isAppError(err) && err.status === 404) notFound();
    throw err;
  }
  const stages = await listStages(ctx);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/${locale}/deals`}>{t("title")}</Link>
        </p>
        <h1 className="page-title">{deal.title}</h1>
        <Badge tone={deal.status === "WON" ? "ok" : deal.status === "LOST" ? "danger" : "default"}>
          {deal.status}
        </Badge>
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Surface style={{ padding: "1.2rem" }}>
          <form action={updateDealAction} style={{ display: "grid", gap: "0.85rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="dealId" value={deal.id} />
            <Field label={t("dealTitle")} htmlFor="title">
              <Input id="title" name="title" defaultValue={deal.title} required />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.75rem" }}>
              <Field label={t("amount")} htmlFor="amount">
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={fromMinor(deal.amountMinor)}
                />
              </Field>
              <Field label={t("currency")} htmlFor="currency">
                <Input id="currency" name="currency" defaultValue={deal.currency} />
              </Field>
            </div>
            <Field label={t("expectedClose")} htmlFor="expectedCloseAt">
              <Input
                id="expectedCloseAt"
                name="expectedCloseAt"
                type="date"
                defaultValue={deal.expectedCloseAt ? deal.expectedCloseAt.toISOString().slice(0, 10) : ""}
              />
            </Field>
            <Button type="submit">Save</Button>
          </form>

          <div style={{ marginTop: "1rem" }}>
            <p className="label">{t("stage")}</p>
            <MoveDealSelect
              locale={locale}
              dealId={deal.id}
              stageId={deal.stageId}
              stages={stages.map((s) => ({ id: s.id, name: s.name }))}
              label={t("move")}
            />
          </div>

          {deal.status === "OPEN" ? (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
              <form action={closeDealAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="dealId" value={deal.id} />
                <input type="hidden" name="outcome" value="WON" />
                <Button type="submit">{t("won")}</Button>
              </form>
              <form action={closeDealAction} style={{ display: "grid", gap: "0.5rem", flex: 1 }}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="dealId" value={deal.id} />
                <input type="hidden" name="outcome" value="LOST" />
                <Input name="lossReason" placeholder={t("lossReason")} required />
                <Button type="submit" variant="danger">
                  {t("lost")}
                </Button>
              </form>
            </div>
          ) : null}

          <p className="muted" style={{ marginTop: "1rem" }}>
            {t("customer")}:{" "}
            {deal.customer ? (
              <Link href={`/${locale}/customers/${deal.customer.id}`}>{deal.customer.name}</Link>
            ) : (
              "—"
            )}
            <br />
            {t("owner")}: {deal.owner?.name ?? "—"}
            <br />
            {t("amount")}: {formatMoney(deal.amountMinor, deal.currency, locale)}
            <br />
            {t("expectedClose")}: {formatDate(deal.expectedCloseAt, locale, ctx.company.timezone)}
            {deal.lossReason ? (
              <>
                <br />
                {t("lossReason")}: {deal.lossReason}
              </>
            ) : null}
          </p>
        </Surface>

        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("activity")}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {deal.activities.map((a) => (
              <li key={a.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid var(--line)" }}>
                <strong>{a.action}</strong>
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {formatDateTime(a.createdAt, locale, ctx.company.timezone)}
                </div>
              </li>
            ))}
          </ul>
        </Surface>

        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{tasksT("title")}</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {deal.tasks.map((task) => (
              <li key={task.id} style={{ padding: "0.4rem 0" }}>
                <Link href={`/${locale}/tasks/${task.id}`}>
                  {task.title}
                  {isTaskOverdue(task.status, task.dueAt) ? (
                    <Badge tone="danger">{tasksT("overdue")}</Badge>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <form action={createTaskAction} style={{ display: "grid", gap: "0.55rem", marginTop: "0.75rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="dealId" value={deal.id} />
            {deal.customerId ? <input type="hidden" name="customerId" value={deal.customerId} /> : null}
            <Input name="title" placeholder={tasksT("taskTitle")} required />
            <Input name="dueAt" type="datetime-local" />
            <Button type="submit" variant="secondary">
              {tasksT("create")}
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
