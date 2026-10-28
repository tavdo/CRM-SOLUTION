import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  Package,
  Printer,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Surface } from "@/components/ui";
import {
  createInvoiceAction,
  createProductAction,
  updateInvoiceStatusAction,
} from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listInvoices } from "@/lib/services/invoices";
import { recordScope } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { ProviderStatus } from "@/components/ProviderStatus";
import { bankAccountProvider, rsGeProvider } from "@/lib/providers";
import { isLocale } from "@/i18n/config";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";
  const statusT = await getTranslations("invoiceStates");

  const [invoices, products, customers, deals] = await Promise.all([
    listInvoices(ctx),
    prisma.product.findMany({
      where: { companyId: ctx.company.id, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { ...recordScope(ctx), archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.deal.findMany({
      where: { ...recordScope(ctx), archivedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const paidTotalMinor = invoices
    .filter((i) => i.status === "PAID")
    .reduce((acc, i) => acc + i.totalMinor, 0);
  const pendingTotalMinor = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((acc, i) => acc + i.totalMinor, 0);

  return (
    <div style={{ display: "grid", gap: "1.35rem" }}>
      <div
        className="rise"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">
            {isKa
              ? "შეთავაზებები · ინვოისები · გადახდის რეკვიზიტები"
              : "QUOTES · INVOICES · PAYMENT DETAILS"}
          </span>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {isKa ? "ინვოისები და პროდუქტების კატალოგი" : "Georgian Invoices & Product Catalog"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Badge tone="ok">
            {isKa ? "გადახდილი" : "PAID"}: {formatMoney(paidTotalMinor, ctx.company.currency, locale)}
          </Badge>
          <Badge tone="warn">
            {isKa ? "მოსალოდნელი" : "OUTSTANDING"}: {formatMoney(pendingTotalMinor, ctx.company.currency, locale)}
          </Badge>
        </div>
      </div>

      {/* Company Tax & Bank Header Strip */}
      <Surface style={{ padding: "0.95rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Building2 size={18} color="#10b981" />
          <div>
            <strong style={{ color: "var(--ink)" }}>
              {ctx.company.legalForm} {ctx.company.name}
            </strong>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              ს/კ (Tax ID): <strong style={{ color: "var(--ink)" }}>{ctx.company.taxId ?? "—"}</strong>
              {" · "}
              BOG IBAN: <strong style={{ color: "var(--ink)" }}>{ctx.company.bogIban ?? "—"}</strong>
              {" · "}
              TBC IBAN: <strong style={{ color: "var(--ink)" }}>{ctx.company.tbcIban ?? "—"}</strong>
            </div>
          </div>
        </div>
        <Badge tone="ok">{ctx.company.isVatPayer ? "დღგ-ს გადამხდელი (18% VAT)" : "Non-VAT"}</Badge>
      </Surface>

      <Surface style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
        <ProviderStatus provider={bankAccountProvider(ctx.company.bogIban || ctx.company.tbcIban)} locale={locale} />
        <ProviderStatus provider={rsGeProvider(invoices.some((invoice) => Boolean(invoice.rsGeWaybillRef)))} locale={locale} />
      </Surface>
      <Surface style={{ overflowX: "auto" }}>
        {invoices.length === 0 ? (
          <EmptyState>{isKa ? "ინვოისები ჯერ არ არის." : "No invoices generated yet."}</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>№</th>
                <th>{isKa ? "კლიენტი (ს/კ)" : "Customer (Tax ID)"}</th>
                <th>{isKa ? "გამოწერის თარიღი" : "Issue Date"}</th>
                <th>{isKa ? "დღგ-ს გარეშე" : "Net"}</th>
                <th>{isKa ? "დღგ (18%)" : "VAT (18%)"}</th>
                <th>{isKa ? "სულ (GEL)" : "Total"}</th>
                <th>RS.ge</th>
                <th>{isKa ? "სტატუსი" : "Status"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/${locale}/invoices/${inv.id}`}>
                      <strong style={{ color: "var(--ink)" }}>{inv.invoiceNumber}</strong>
                    </Link>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.customer.name}</div>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      ს/კ: {inv.customer.taxId ?? "—"}
                    </div>
                  </td>
                  <td className="muted">
                    {formatDate(inv.issueDate, locale, ctx.company.timezone)}
                  </td>
                  <td className="muted">
                    {formatMoney(inv.subtotalMinor, inv.currency, locale)}
                  </td>
                  <td className="muted">
                    {formatMoney(inv.vatMinor, inv.currency, locale)}
                  </td>
                  <td style={{ fontWeight: 750, color: "var(--brand)" }}>
                    {formatMoney(inv.totalMinor, inv.currency, locale)}
                  </td>
                  <td>
                    {inv.rsGeWaybillRef ? (
                      <Badge>{inv.rsGeWaybillRef}</Badge>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={inv.status === "PAID" ? "ok" : "warn"}>
                      {statusT.has(inv.status) ? statusT(inv.status) : inv.status}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Link
                        href={`/${locale}/invoices/${inv.id}`}
                        className="btn btn-secondary"
                        style={{ padding: "0.35rem 0.7rem", fontSize: "0.76rem" }}
                      >
                        <Printer size={13} />
                        <span>{isKa ? "ნახვა / PDF" : "View / PDF"}</span>
                      </Link>
                      {inv.status === "QUOTE" ? (
                        <Link
                          href={`/${locale}/invoices/${inv.id}`}
                          className="btn btn-secondary"
                          style={{ padding: "0.35rem 0.7rem", fontSize: "0.76rem" }}
                        >
                          {isKa ? "შეთავაზება" : "Quote"}
                        </Link>
                      ) : inv.status !== "PAID" ? (
                        <form action={updateInvoiceStatusAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="status" value="PAID" />
                          <Button
                            type="submit"
                            style={{ padding: "0.35rem 0.7rem", fontSize: "0.76rem" }}
                          >
                            <CheckCircle2 size={13} />
                            <span>{isKa ? "გადახდილია" : "Mark Paid"}</span>
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>

      {/* Two-Column: Issue New Invoice + Products Catalog */}
      <div
        style={{
          display: "grid",
          gap: "1.15rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          alignItems: "start",
        }}
      >
        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
            <FileSpreadsheet size={16} color="#10b981" />
            <h2 className="section-title">
              {isKa ? "შეთავაზება ან ინვოისი (დღგ 18%)" : "Quote or Invoice (18% VAT)"}
            </h2>
          </div>
          <form action={createInvoiceAction} style={{ display: "grid", gap: "0.75rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <Field label={isKa ? "კლიენტი (მყიდველი)" : "Customer (Buyer)"} htmlFor="customerId">
              <select id="customerId" name="customerId" className="select" required>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.taxId ? `(ს/კ: ${c.taxId})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isKa ? "დაკავშირებული გარიგება" : "Linked Deal (Optional)"} htmlFor="dealId">
              <select id="dealId" name="dealId" className="select" defaultValue="">
                <option value="">—</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isKa ? "კატალოგიდან პროდუქტი" : "Catalog product"} htmlFor="productId">
              <select id="productId" name="productId" className="select" defaultValue="">
                <option value="">{isKa ? "— თავისუფალი ტექსტი —" : "— free text —"}</option>
                {products
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={isKa ? "მომსახურების / პროდუქტის დასახელება" : "Item / Service Description"} htmlFor="description">
              <Input
                id="description"
                name="description"
                defaultValue={products[0]?.name ?? "CRM სისტემის დანერგვა"}
                required
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "90px 110px 1fr", gap: "0.6rem" }}>
              <Field label={isKa ? "რაოდ." : "Qty"} htmlFor="quantity">
                <Input id="quantity" name="quantity" type="number" defaultValue="1" min={1} required />
              </Field>
              <Field label={isKa ? "ერთეული" : "Unit"} htmlFor="unit">
                <Input id="unit" name="unit" defaultValue="პაკეტი" />
              </Field>
              <Field label={isKa ? "ერთეულის ფასი (GEL, დღგ-ს გარეშე)" : "Unit Price (GEL Net)"} htmlFor="unitPrice">
                <Input id="unitPrice" name="unitPrice" type="number" step="0.01" defaultValue="12500" required />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <Field label={isKa ? "დღგ-ს დარიცხვა (18%)" : "Apply 18% Georgian VAT"} htmlFor="includeVat">
                <select id="includeVat" name="includeVat" className="select" defaultValue="true">
                  <option value="true">{isKa ? "დიახ (+18% დღგ)" : "Yes (+18% VAT / დღგ)"}</option>
                  <option value="false">{isKa ? "არა (დღგ-ს გარეშე)" : "No (0% VAT)"}</option>
                </select>
              </Field>
              <Field label={isKa ? "RS.ge ზედნადების / ფაქტურის №" : "RS.ge Waybill Ref"} htmlFor="rsGeWaybillRef">
                <Input id="rsGeWaybillRef" name="rsGeWaybillRef" placeholder="RS-0749..." />
              </Field>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.85rem",
                color: "var(--ink-secondary)",
              }}
            >
              <input type="checkbox" name="asQuote" value="1" />
              {isKa ? "შეინახე როგორც შეთავაზება (QTE) — არა ინვოისი" : "Save as Quote (QTE) — not an invoice yet"}
            </label>
            <Button type="submit">
              <Plus size={15} />
              <span>{isKa ? "გენერირება" : "Generate"}</span>
            </Button>
          </form>
        </Surface>

        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "0.9rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Package size={16} color="#38bdf8" />
              <h2 className="section-title">
                {isKa ? "პროდუქტების კატალოგი" : "Products catalog"}
              </h2>
            </div>
            <Link href={`/${locale}/products`} className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }}>
              {isKa ? "სრული კატალოგი" : "Full catalog"}
            </Link>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", display: "grid", gap: "0.5rem" }}>
            {products.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: "0.65rem 0.8rem",
                  borderRadius: 10,
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <strong style={{ color: "var(--ink)", fontSize: "0.88rem" }}>{p.name}</strong>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {p.sku ?? "SKU"} · {p.unit}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--brand)" }}>
                  {formatMoney(p.priceMinor, p.currency, locale)}
                </div>
              </li>
            ))}
          </ul>

          <form action={createProductAction} style={{ display: "grid", gap: "0.6rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.55rem" }}>
              <Input name="sku" placeholder="SKU-01" />
              <Input
                name="name"
                placeholder={isKa ? "პროდუქტის დასახელება" : "Product / service name"}
                required
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.55rem" }}>
              <Input name="unit" defaultValue="ცალი" placeholder="ერთეული" />
              <Input name="price" type="number" step="0.01" placeholder="ფასი (GEL)" required />
            </div>
            <Button type="submit" variant="secondary">
              <Plus size={14} />
              <span>{isKa ? "კატალოგში დამატება" : "Add to Catalog"}</span>
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
