import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Inbox,
  ArrowRight,
  Phone,
  MessageCircle,
  Globe,
  Share2,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Surface, Textarea } from "@/components/ui";
import {
  convertLeadAction,
  createLeadAction,
  updateLeadStatusAction,
} from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { isLocale } from "@/i18n/config";

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";

  const whereStatus = sp.status && sp.status !== "ALL" ? sp.status : undefined;

  const leads = await prisma.lead.findMany({
    where: {
      companyId: ctx.company.id,
      ...(whereStatus ? { status: whereStatus } : {}),
    },
    include: { owner: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.lead.groupBy({
    by: ["status"],
    where: { companyId: ctx.company.id },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

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
            {isKa ? "OMNICHANNEL · ლიდების მართვა" : "OMNICHANNEL · LEADS INBOX"}
          </span>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {isKa ? "შემომავალი ლიდები (Bitrix24 Leads)" : "Incoming Leads Inbox"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: isKa ? "ყველა" : "All" },
            { key: "NEW", label: `${isKa ? "ახალი" : "New"} (${countMap.NEW ?? 0})` },
            { key: "CONTACTED", label: `${isKa ? "დაკავშირებული" : "Contacted"} (${countMap.CONTACTED ?? 0})` },
            { key: "QUALIFIED", label: `${isKa ? "კვალიფიციური" : "Qualified"} (${countMap.QUALIFIED ?? 0})` },
            { key: "CONVERTED", label: `${isKa ? "კონვერტირებული" : "Converted"} (${countMap.CONVERTED ?? 0})` },
          ].map((f) => {
            const active = (sp.status ?? "ALL") === f.key;
            return (
              <Link
                key={f.key}
                href={`/${locale}/leads?status=${f.key}`}
                className={`btn ${active ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1.15rem",
          gridTemplateColumns: "minmax(0, 1.9fr) minmax(300px, 1fr)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {leads.length === 0 ? (
            <Surface>
              <EmptyState>
                {isKa ? "ამ ფილტრით ლიდები არ მოიძებნა." : "No leads in this view yet."}
              </EmptyState>
            </Surface>
          ) : (
            leads.map((lead) => (
              <Surface
                key={lead.id}
                className="surface-interactive"
                style={{ padding: "1.15rem 1.25rem" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <SourceBadge source={lead.source} />
                      <Badge
                        tone={
                          lead.status === "CONVERTED"
                            ? "ok"
                            : lead.status === "QUALIFIED"
                              ? "warn"
                              : "default"
                        }
                      >
                        {lead.status}
                      </Badge>
                      {lead.taxId ? (
                        <Badge>ს/კ: {lead.taxId}</Badge>
                      ) : null}
                    </div>
                    <h2 style={{ margin: "0.55rem 0 0.2rem", fontSize: "1.02rem", color: "#fff" }}>
                      {lead.title}
                    </h2>
                    <div className="muted" style={{ fontSize: "0.84rem" }}>
                      <strong style={{ color: "var(--ink-secondary)" }}>{lead.contactName}</strong>
                      {lead.companyName ? ` · ${lead.companyName}` : ""}
                      {lead.phone ? ` · ${lead.phone}` : ""}
                      {lead.email ? ` · ${lead.email}` : ""}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 750, fontSize: "1.05rem", color: "var(--brand)" }}>
                      {formatMoney(lead.amountMinor, lead.currency, locale)}
                    </div>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {lead.owner?.name ?? "—"}
                    </div>
                  </div>
                </div>

                {lead.notes ? (
                  <p
                    className="muted"
                    style={{
                      margin: "0.7rem 0 0",
                      padding: "0.55rem 0.75rem",
                      background: "rgba(255,255,255,0.025)",
                      borderRadius: 9,
                      border: "1px solid var(--line)",
                      fontSize: "0.83rem",
                    }}
                  >
                    {lead.notes}
                  </p>
                ) : null}

                <div
                  style={{
                    marginTop: "0.9rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <form action={updateLeadStatusAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="leadId" value={lead.id} />
                    <select
                      name="status"
                      className="select"
                      defaultValue={lead.status}
                      style={{ width: "auto", padding: "0.38rem 0.65rem", fontSize: "0.78rem" }}
                    >
                      <option value="NEW">NEW</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="QUALIFIED">QUALIFIED</option>
                      <option value="JUNK">JUNK</option>
                    </select>
                    <Button type="submit" variant="secondary" style={{ padding: "0.38rem 0.75rem", fontSize: "0.78rem" }}>
                      {isKa ? "განახლება" : "Update"}
                    </Button>
                  </form>

                  {lead.status === "CONVERTED" && lead.convertedDealId ? (
                    <Link
                      href={`/${locale}/deals/${lead.convertedDealId}`}
                      className="btn btn-secondary"
                      style={{ padding: "0.42rem 0.85rem", fontSize: "0.8rem" }}
                    >
                      <CheckCircle2 size={14} color="#10b981" />
                      <span>{isKa ? "გახსენით გარიგება" : "Open Converted Deal"}</span>
                    </Link>
                  ) : (
                    <form action={convertLeadAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="leadId" value={lead.id} />
                      <Button type="submit" style={{ padding: "0.45rem 0.95rem", fontSize: "0.8rem" }}>
                        <span>
                          {isKa
                            ? "კლიენტად + გარიგებად გადაყვანა"
                            : "Convert to Customer + Deal"}
                        </span>
                        <ArrowRight size={14} />
                      </Button>
                    </form>
                  )}
                </div>
              </Surface>
            ))
          )}
        </div>

        {/* Create Lead Card */}
        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
            <Plus size={16} color="#10b981" />
            <h2 className="section-title">
              {isKa ? "ახალი ლიდის დამატება" : "Capture New Lead"}
            </h2>
          </div>
          <form action={createLeadAction} style={{ display: "grid", gap: "0.75rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <Field label={isKa ? "ლიდის სათაური / მოთხოვნა" : "Lead title / inquiry"} htmlFor="title">
              <Input
                id="title"
                name="title"
                placeholder={isKa ? "მაგ: POS სისტემის დანერგვა" : "e.g. POS & ERP rollout"}
                required
              />
            </Field>
            <Field label={isKa ? "საკონტაქტო პირი" : "Contact person"} htmlFor="contactName">
              <Input id="contactName" name="contactName" required />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 125px", gap: "0.6rem" }}>
              <Field label={isKa ? "კომპანია (შპს / სს)" : "Company name"} htmlFor="companyName">
                <Input id="companyName" name="companyName" placeholder="შპს ..." />
              </Field>
              <Field label={isKa ? "ს/კ (9 ციფრი)" : "Tax ID (ს/კ)"} htmlFor="taxId">
                <Input id="taxId" name="taxId" placeholder="405..." maxLength={11} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <Field label={isKa ? "ტელეფონი" : "Phone"} htmlFor="phone">
                <Input id="phone" name="phone" placeholder="+995 5..." />
              </Field>
              <Field label={isKa ? "არხი (Source)" : "Channel / Source"} htmlFor="source">
                <select id="source" name="source" className="select" defaultValue="FACEBOOK">
                  <option value="FACEBOOK">Facebook Messenger</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="INSTAGRAM">Instagram DM</option>
                  <option value="MYPHONE">MyPhone / Silknet SIP</option>
                  <option value="WEBSITE">Website Lead Form</option>
                  <option value="REFERRAL">Referral</option>
                </select>
              </Field>
            </div>
            <Field label={isKa ? "სავარაუდო ბიუჯეტი (GEL)" : "Estimated Value (GEL)"} htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" defaultValue="1500" />
            </Field>
            <Field label={isKa ? "შენიშვნა" : "Notes"} htmlFor="notes">
              <Textarea id="notes" name="notes" style={{ minHeight: 68 }} />
            </Field>
            <Button type="submit">
              <Inbox size={15} />
              <span>{isKa ? "ლიდის შენახვა" : "Save Lead"}</span>
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const icon =
    source === "MYPHONE" ? (
      <Phone size={11} />
    ) : source === "WHATSAPP" || source === "FACEBOOK" || source === "INSTAGRAM" ? (
      <MessageCircle size={11} />
    ) : source === "WEBSITE" ? (
      <Globe size={11} />
    ) : (
      <Share2 size={11} />
    );
  return (
    <Badge tone="ok">
      {icon}
      <span>{source}</span>
    </Badge>
  );
}
