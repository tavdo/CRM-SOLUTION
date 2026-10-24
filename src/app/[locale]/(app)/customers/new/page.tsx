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
  const isKa = locale === "ka";
  const members = can(ctx.role, "crm.assign")
    ? await prisma.membership.findMany({
        where: { companyId: ctx.company.id },
        include: { user: true },
      })
    : [];

  return (
    <div style={{ maxWidth: 620, display: "grid", gap: "1rem" }}>
      <h1 className="page-title">{t("new")}</h1>
      <Surface style={{ padding: "1.35rem" }}>
        <form action={createCustomerAction} style={{ display: "grid", gap: "0.9rem" }}>
          <input type="hidden" name="locale" value={locale} />
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 150px", gap: "0.65rem" }}>
            <Field label={isKa ? "ფორმა" : "Legal Form"} htmlFor="legalForm">
              <select id="legalForm" name="legalForm" className="select" defaultValue="შპს">
                <option value="შპს">შპს (LLC)</option>
                <option value="სს">სს (JSC)</option>
                <option value="ი/მ">ი/მ (Sole Prop.)</option>
                <option value="ფიზ. პირი">ფიზიკური პირი</option>
              </select>
            </Field>
            <Field label={t("name")} htmlFor="name">
              <Input id="name" name="name" required />
            </Field>
            <Field label={isKa ? "ს/კ (9 ციფრი)" : "Tax ID (ს/კ)"} htmlFor="taxId">
              <Input id="taxId" name="taxId" placeholder="405123456" maxLength={11} />
            </Field>
          </div>
          <Field label={isKa ? "საბანკო ანგარიში (BOG / TBC IBAN)" : "Bank IBAN (GE..BG.. / GE..TB..)"} htmlFor="bankIban">
            <Input id="bankIban" name="bankIban" placeholder="GE29BG0000000101904917" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
            <Field label={t("email")} htmlFor="email">
              <Input id="email" name="email" type="email" />
            </Field>
            <Field label={t("phone")} htmlFor="phone">
              <Input id="phone" name="phone" placeholder="+995 5..." />
            </Field>
          </div>
          <Field label={t("website")} htmlFor="website">
            <Input id="website" name="website" />
          </Field>
          <Field label={t("address")} htmlFor="address">
            <Input id="address" name="address" placeholder={isKa ? "თბილისი, ..." : "Tbilisi, Georgia"} />
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
