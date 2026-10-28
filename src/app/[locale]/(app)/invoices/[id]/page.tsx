import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Badge, Button, Surface } from "@/components/ui";
import { PrintInvoiceButton } from "@/components/PrintInvoiceButton";
import {
  convertQuoteToInvoiceAction,
  updateInvoiceStatusAction,
} from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getInvoice } from "@/lib/services/invoices";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { ProviderStatus } from "@/components/ProviderStatus";
import { bankAccountProvider, rsGeProvider } from "@/lib/providers";
import { isLocale } from "@/i18n/config";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";
  const statusT = await getTranslations("invoiceStates");

  const invoice = await getInvoice(ctx, id).catch((error) => {
    if (isAppError(error) && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  });

  return (
    <div style={{ display: "grid", gap: "1.2rem", maxWidth: 880 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <Link href={`/${locale}/invoices`} className="btn btn-secondary">
          <ArrowLeft size={15} />
          <span>{isKa ? "ინვოისების სია" : "Back to Invoices"}</span>
        </Link>

        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          <PrintInvoiceButton label={isKa ? "ბეჭდვა / PDF შენახვა" : "Print / Save PDF"} />
          {invoice.status === "QUOTE" ? (
            <form action={convertQuoteToInvoiceAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit">
                <CheckCircle2 size={15} />
                <span>{isKa ? "ინვოისად გადაქცევა" : "Convert quote → Invoice"}</span>
              </Button>
            </form>
          ) : null}
          {invoice.status !== "PAID" && invoice.status !== "QUOTE" ? (
            <form action={updateInvoiceStatusAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={invoice.id} />
              <input type="hidden" name="status" value="PAID" />
              <Button type="submit">
                <CheckCircle2 size={15} />
                <span>{isKa ? "გადახდილად მონიშვნა" : "Mark as Paid"}</span>
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Surface style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
        <ProviderStatus provider={bankAccountProvider(ctx.company.bogIban || ctx.company.tbcIban)} locale={locale} />
        <ProviderStatus provider={rsGeProvider(Boolean(invoice.rsGeWaybillRef))} locale={locale} />
      </Surface>
      <Surface style={{ padding: "2.2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1.5rem",
            flexWrap: "wrap",
            paddingBottom: "1.35rem",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <span className="kicker">
              {invoice.status === "QUOTE"
                ? isKa
                  ? "შეთავაზება / QUOTE"
                  : "QUOTE / შეთავაზება"
                : "ინვოისი / INVOICE"}
            </span>
            <h1 className="page-title" style={{ marginTop: 4 }}>
              {invoice.invoiceNumber}
            </h1>
            <div className="muted" style={{ fontSize: "0.84rem", marginTop: 4 }}>
              {isKa ? "თარიღი" : "Issue Date"}: {formatDate(invoice.issueDate, locale, ctx.company.timezone)}
              {invoice.dueDate
                ? ` · ${isKa ? "ვადა" : "Due"}: ${formatDate(invoice.dueDate, locale, ctx.company.timezone)}`
                : ""}
            </div>
          </div>

          <div style={{ textAlign: "right", display: "grid", gap: 6, justifyItems: "end" }}>
            <Badge tone={invoice.status === "PAID" ? "ok" : "warn"}>
              {statusT.has(invoice.status) ? statusT(invoice.status) : invoice.status}
            </Badge>
            {invoice.rsGeWaybillRef ? (
              <Badge>RS.ge: {invoice.rsGeWaybillRef}</Badge>
            ) : null}
          </div>
        </div>

        {/* Seller & Buyer Details (Georgian ს/კ & Bank IBANs) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.5rem",
            marginTop: "1.35rem",
            paddingBottom: "1.35rem",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              {isKa ? "მიმწოდებელი (SELLER)" : "SELLER (მიმწოდებელი)"}
            </div>
            <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>
              {ctx.company.legalForm} {ctx.company.name}
            </strong>
            <div className="muted" style={{ fontSize: "0.84rem", marginTop: 4, lineHeight: 1.6 }}>
              საიდენტიფიკაციო კოდი (ს/კ): <strong style={{ color: "var(--ink)" }}>{ctx.company.taxId ?? "—"}</strong>
              <br />
              საქართველოს ბანკი (BAGAGE22): <strong style={{ color: "var(--ink)" }}>{ctx.company.bogIban ?? "—"}</strong>
              <br />
              თიბისი ბანკი (TBCBGE22): <strong style={{ color: "var(--ink)" }}>{ctx.company.tbcIban ?? "—"}</strong>
              {ctx.company.address ? (
                <>
                  <br />
                  {ctx.company.address}
                </>
              ) : null}
            </div>
          </div>

          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              {isKa ? "მყიდველი (BUYER)" : "BUYER (მყიდველი)"}
            </div>
            <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>
              {invoice.customer.legalForm ?? "შპს"} {invoice.customer.name}
            </strong>
            <div className="muted" style={{ fontSize: "0.84rem", marginTop: 4, lineHeight: 1.6 }}>
              საიდენტიფიკაციო კოდი (ს/კ): <strong style={{ color: "var(--ink)" }}>{invoice.customer.taxId ?? "—"}</strong>
              {invoice.customer.bankIban ? (
                <>
                  <br />
                  IBAN: <strong style={{ color: "var(--ink)" }}>{invoice.customer.bankIban}</strong>
                </>
              ) : null}
              {invoice.customer.address ? (
                <>
                  <br />
                  {invoice.customer.address}
                </>
              ) : null}
              {invoice.customer.email ? (
                <>
                  <br />
                  {invoice.customer.email}
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <table className="table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>{isKa ? "დასახელება / აღწერა" : "Description"}</th>
              <th>{isKa ? "რაოდ." : "Qty"}</th>
              <th>{isKa ? "ერთეული" : "Unit"}</th>
              <th>{isKa ? "ფასი" : "Unit Price"}</th>
              <th>{isKa ? "ჯამი" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td>
                  <strong style={{ color: "var(--ink)" }}>{item.description}</strong>
                </td>
                <td>{item.quantity}</td>
                <td className="muted">{item.unit}</td>
                <td>{formatMoney(item.unitMinor, invoice.currency, locale)}</td>
                <td style={{ fontWeight: 700 }}>
                  {formatMoney(item.totalMinor, invoice.currency, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & 18% Georgian VAT */}
        <div
          style={{
            marginTop: "1.35rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              {invoice.notes}
            </div>
          </div>

          <div
            style={{
              minWidth: 260,
              padding: "1rem 1.2rem",
              borderRadius: 12,
              background: "var(--bg-subtle)",
              border: "1px solid var(--line)",
              display: "grid",
              gap: "0.45rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">{isKa ? "ჯამი დღგ-ს გარეშე:" : "Subtotal (Net):"}</span>
              <strong>{formatMoney(invoice.subtotalMinor, invoice.currency, locale)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">
                {isKa ? `დღგ (${invoice.vatRate}%):` : `Georgian VAT (${invoice.vatRate}%):`}
              </span>
              <strong>{formatMoney(invoice.vatMinor, invoice.currency, locale)}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "0.45rem",
                borderTop: "1px solid var(--line)",
                fontSize: "1.08rem",
              }}
            >
              <strong>{isKa ? "სულ გადასახდელი:" : "Total Due:"}</strong>
              <strong style={{ color: "var(--brand)" }}>
                {formatMoney(invoice.totalMinor, invoice.currency, locale)}
              </strong>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
