import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  addContactAction,
  addCustomerNoteAction,
  archiveCustomerAction,
  saveCustomValuesAction,
  updateCustomerAction,
} from "@/app/actions/crm";
import { Badge, Button, Field, Input, Surface, Textarea } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getCustomer } from "@/lib/services/customers";
import { formatDateTime } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/db";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("customers");

  let customer;
  try {
    customer = await getCustomer(ctx, id);
  } catch (err) {
    if (isAppError(err) && err.status === 404) notFound();
    throw err;
  }

  const fields = await prisma.customFieldDefinition.findMany({
    where: { companyId: ctx.company.id, archivedAt: null },
    orderBy: { sortOrder: "asc" },
  });

  const valueMap = Object.fromEntries(
    customer.customValues.map((v) => [
      v.fieldId,
      v.valueText ?? v.valueNumber?.toString() ?? (v.valueDate ? v.valueDate.toISOString().slice(0, 10) : ""),
    ]),
  );

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p className="muted" style={{ margin: 0 }}>
            <Link href={`/${locale}/customers`}>{t("title")}</Link>
          </p>
          <h1 className="page-title">{customer.name}</h1>
          {customer.archivedAt ? <Badge tone="warn">{t("archived")}</Badge> : null}
        </div>
        {!customer.archivedAt ? (
          <form action={archiveCustomerAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={customer.id} />
            <Button type="submit" variant="danger">
              {t("archive")}
            </Button>
          </form>
        ) : null}
      </div>

      <Surface style={{ padding: "1.2rem" }}>
        <form action={updateCustomerAction} style={{ display: "grid", gap: "0.85rem" }}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={customer.id} />
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 160px", gap: "0.75rem" }}>
            <Field label="Legal Form / ფორმა" htmlFor="legalForm">
              <select id="legalForm" name="legalForm" className="select" defaultValue={customer.legalForm ?? "შპს"}>
                <option value="შპს">შპს (LLC)</option>
                <option value="სს">სს (JSC)</option>
                <option value="ი/მ">ი/მ (Sole Prop.)</option>
                <option value="ფიზ. პირი">ფიზიკური პირი</option>
              </select>
            </Field>
            <Field label={t("name")} htmlFor="name">
              <Input id="name" name="name" defaultValue={customer.name} required />
            </Field>
            <Field label="ს/კ (Tax ID)" htmlFor="taxId">
              <Input id="taxId" name="taxId" defaultValue={customer.taxId ?? ""} placeholder="405123456" />
            </Field>
          </div>
          <Field label="Bank IBAN (GE..BG.. / GE..TB..)" htmlFor="bankIban">
            <Input id="bankIban" name="bankIban" defaultValue={customer.bankIban ?? ""} placeholder="GE29BG0000000101904917" />
          </Field>
          <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Field label={t("email")} htmlFor="email">
              <Input id="email" name="email" defaultValue={customer.email ?? ""} />
            </Field>
            <Field label={t("phone")} htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={customer.phone ?? ""} />
            </Field>
          </div>
          <Field label={t("website")} htmlFor="website">
            <Input id="website" name="website" defaultValue={customer.website ?? ""} />
          </Field>
          <Field label={t("address")} htmlFor="address">
            <Input id="address" name="address" defaultValue={customer.address ?? ""} />
          </Field>
          <Button type="submit">{t("save")}</Button>
        </form>
      </Surface>

      {fields.length > 0 ? (
        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("customFields")}</h2>
          <form action={saveCustomValuesAction} style={{ display: "grid", gap: "0.85rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="customerId" value={customer.id} />
            {fields.map((f) => (
              <Field key={f.id} label={f.name} htmlFor={`field_${f.id}`}>
                {f.fieldType === "SELECT" ? (
                  <select
                    id={`field_${f.id}`}
                    name={`field_${f.id}`}
                    className="select"
                    defaultValue={valueMap[f.id] ?? ""}
                  >
                    <option value="">—</option>
                    {(JSON.parse(f.options ?? "[]") as string[]).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`field_${f.id}`}
                    name={`field_${f.id}`}
                    type={f.fieldType === "NUMBER" ? "number" : f.fieldType === "DATE" ? "date" : "text"}
                    defaultValue={valueMap[f.id] ?? ""}
                  />
                )}
              </Field>
            ))}
            <Button type="submit">{t("save")}</Button>
          </form>
        </Surface>
      ) : null}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("contacts")}</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {customer.contacts.map((c) => (
              <li key={c.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid var(--line)" }}>
                <strong>
                  {c.firstName} {c.lastName}
                </strong>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {c.email ?? c.phone ?? "—"}
                </div>
              </li>
            ))}
          </ul>
          <form action={addContactAction} style={{ display: "grid", gap: "0.6rem", marginTop: "1rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="customerId" value={customer.id} />
            <Input name="firstName" placeholder={t("firstName")} required />
            <Input name="lastName" placeholder={t("lastName")} required />
            <Input name="email" placeholder={t("email")} />
            <Button type="submit" variant="secondary">
              {t("addContact")}
            </Button>
          </form>
        </Surface>

        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("notes")}</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {customer.notes.map((n) => (
              <li key={n.id} style={{ padding: "0.55rem 0", borderBottom: "1px solid var(--line)" }}>
                <div>{n.body}</div>
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {n.author.name} · {formatDateTime(n.createdAt, locale, ctx.company.timezone)}
                </div>
              </li>
            ))}
          </ul>
          <form action={addCustomerNoteAction} style={{ display: "grid", gap: "0.6rem", marginTop: "1rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="customerId" value={customer.id} />
            <Textarea name="body" required />
            <Button type="submit" variant="secondary">
              {t("addNote")}
            </Button>
          </form>
        </Surface>

        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("deals")}</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {customer.deals.map((d) => (
              <li key={d.id} style={{ padding: "0.45rem 0" }}>
                <Link href={`/${locale}/deals/${d.id}`}>
                  <strong>{d.title}</strong>
                </Link>
                <div className="muted">{d.stage.name}</div>
              </li>
            ))}
          </ul>
          <Link href={`/${locale}/deals/new?customerId=${customer.id}`} className="btn btn-secondary">
            +
          </Link>
        </Surface>
      </div>
    </div>
  );
}
