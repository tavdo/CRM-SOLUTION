import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createTaskAction } from "@/app/actions/crm";
import { Button, Field, Input, Surface, Textarea } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listCustomers } from "@/lib/services/customers";
import { listDeals } from "@/lib/services/deals";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";
import styles from "@/components/WorkspaceForm.module.css";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("tasks");
  const c = await getTranslations("construction");
  const [customers, deals, members] = await Promise.all([
    listCustomers(ctx, { pageSize: 100 }),
    listDeals(ctx),
    can(ctx.role, "crm.assign")
      ? prisma.membership.findMany({
          where: { companyId: ctx.company.id },
          include: { user: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className={styles.page}>
      <div className="construction-heading">
        <h1 className="page-title">{t("new")}</h1>
        <Link href={`/${locale}/projects`} className="btn btn-secondary">{c("projects")} → {c("newWork")}</Link>
      </div>
      <Surface className={styles.panel}>
        <form action={createTaskAction} className={styles.form}>
          <input type="hidden" name="locale" value={locale} />
          <div className={styles.wide}>
            <Field label={t("taskTitle")} htmlFor="title">
              <Input id="title" name="title" required />
            </Field>
          </div>
          <Field label={t("due")} htmlFor="dueAt">
            <Input id="dueAt" name="dueAt" type="datetime-local" />
          </Field>
          {members.length > 0 ? (
            <Field label={t("owner")} htmlFor="ownerId">
              <select id="ownerId" name="ownerId" className="select" defaultValue={ctx.user.id}>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label={t("linkedCustomer")} htmlFor="customerId">
            <select id="customerId" name="customerId" className="select" defaultValue="">
              <option value="">—</option>
              {customers.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("linkedDeal")} htmlFor="dealId">
            <select id="dealId" name="dealId" className="select" defaultValue="">
              <option value="">—</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
          <div className={styles.full}>
            <Field label={t("description")} htmlFor="description">
              <Textarea id="description" name="description" />
            </Field>
          </div>
          <div className={styles.actions}>
            <Button type="submit">{t("create")}</Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}
