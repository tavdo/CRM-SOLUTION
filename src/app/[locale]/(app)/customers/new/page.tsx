import { getTranslations, setRequestLocale } from "next-intl/server";
import { createCustomerAction } from "@/app/actions/crm";
import { Button, Field, Input, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function NewCustomerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("customers");
  const members = can(ctx.role, "crm.assign")
    ? await prisma.membership.findMany({
        where: { companyId: ctx.company.id },
        include: { user: true },
      })
    : [];

  return (
    <div style={{ maxWidth: 560, display: "grid", gap: "1rem" }}>
      <h1 className="page-title">{t("new")}</h1>
      <Surface style={{ padding: "1.25rem" }}>
        <form action={createCustomerAction} style={{ display: "grid", gap: "0.9rem" }}>
          <input type="hidden" name="locale" value={locale} />
          <Field label={t("name")} htmlFor="name">
            <Input id="name" name="name" required />
          </Field>
          <Field label={t("email")} htmlFor="email">
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label={t("phone")} htmlFor="phone">
            <Input id="phone" name="phone" />
          </Field>
          <Field label={t("website")} htmlFor="website">
            <Input id="website" name="website" />
          </Field>
          <Field label={t("address")} htmlFor="address">
            <Input id="address" name="address" />
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
