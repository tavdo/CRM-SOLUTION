import { getTranslations, setRequestLocale } from "next-intl/server";
import { createDealAction } from "@/app/actions/crm";
import { Button, Field, Input, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listStages } from "@/lib/services/deals";
import { listCustomers } from "@/lib/services/customers";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function NewDealPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("deals");
  const [stages, customers, members] = await Promise.all([
    listStages(ctx),
    listCustomers(ctx, { pageSize: 100 }),
    can(ctx.role, "crm.assign")
      ? prisma.membership.findMany({
          where: { companyId: ctx.company.id },
          include: { user: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div style={{ maxWidth: 560, display: "grid", gap: "1rem" }}>
      <h1 className="page-title">{t("new")}</h1>
      <Surface style={{ padding: "1.25rem" }}>
        <form action={createDealAction} style={{ display: "grid", gap: "0.9rem" }}>
          <input type="hidden" name="locale" value={locale} />
          <Field label={t("dealTitle")} htmlFor="title">
            <Input id="title" name="title" required />
          </Field>
          <Field label={t("customer")} htmlFor="customerId">
            <select
              id="customerId"
              name="customerId"
              className="select"
              defaultValue={sp.customerId ?? ""}
            >
              <option value="">—</option>
              {customers.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("stage")} htmlFor="stageId">
            <select id="stageId" name="stageId" className="select">
              {stages
                .filter((s) => !s.isWon && !s.isLost)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.75rem" }}>
            <Field label={t("amount")} htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" defaultValue="0" />
            </Field>
            <Field label={t("currency")} htmlFor="currency">
              <Input id="currency" name="currency" defaultValue={ctx.company.currency} />
            </Field>
          </div>
          <Field label={t("expectedClose")} htmlFor="expectedCloseAt">
            <Input id="expectedCloseAt" name="expectedCloseAt" type="date" />
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
          <Button type="submit">{t("create")}</Button>
        </form>
      </Surface>
    </div>
  );
}
