import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Headset,
  MessageCircle,
  PhoneCall,
  Smartphone,
  FileCheck2,
  Landmark,
  Globe,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Badge, Button, Surface } from "@/components/ui";
import { createLeadAction } from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { isLocale } from "@/i18n/config";

export default async function ContactCenterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";

  const channels = [
    {
      title: "Facebook Page & Instagram DM",
      provider: "Meta Graph API",
      status: "READY",
      icon: MessageCircle,
      desc: isKa
        ? "ყველა მესიჯი და კომენტარი Facebook / Instagram გვერდიდან ავტომატურად ქმნის ლიდს."
        : "Inbound Facebook Page messages & Instagram DMs automatically create Leads in the Inbox.",
      simTitle: "Facebook DM — Tbilisi Mall Store Inquiry",
      simSource: "FACEBOOK",
    },
    {
      title: "WhatsApp Business Cloud",
      provider: "WhatsApp API (+995)",
      status: "READY",
      icon: MessageCircle,
      desc: isKa
        ? "WhatsApp-ის მიმოწერა და სწრაფი შაბლონები ქართული ნომრებისთვის (+995)."
        : "Two-way WhatsApp Business messaging and template replies for +995 numbers.",
      simTitle: "WhatsApp Inquiry — Batumi Logistics Fleet",
      simSource: "WHATSAPP",
    },
    {
      title: "Georgian VoIP Telephony (SIP PBX)",
      provider: "MyPhone.ge · Silknet · Magti Fix",
      status: "READY",
      icon: PhoneCall,
      desc: isKa
        ? "შემომავალი და გამავალი ზარების ფიქსაცია, კლიენტის ბარათის ამოხტომა და ზარის ჩანაწერი."
        : "SIP trunk integration with MyPhone.ge & Silknet — pop-up customer card on inbound calls.",
      simTitle: "Inbound Call (MyPhone SIP) — Kutaisi Medical Center",
      simSource: "MYPHONE",
    },
    {
      title: "Georgian SMS Gateways",
      provider: "Sender.ge · SMSOffice.ge · GOSMS.ge",
      status: "SANDBOX",
      icon: Smartphone,
      desc: isKa
        ? "SMS შეტყობინებების გაგზავნა კლიენტებთან (ინვოისის ბმული, შეხვედრის შეხსენება)."
        : "Automated SMS notifications for Georgian mobile carriers with brand sender name.",
      simTitle: "SMS Callback Request — Rustavi Auto Parts",
      simSource: "WEBSITE",
    },
    {
      title: "RS.ge Revenue Service Portal",
      provider: "RS.ge Waybills & VAT Invoices",
      status: "CONNECTED",
      icon: FileCheck2,
      desc: isKa
        ? "ს/კ ვალიდაცია, 18% დღგ-ს ანგარიშ-ფაქტურების და სასაქონლო ზედნადებების რეფერენსი."
        : "9-digit Georgian Tax ID (ს/კ) tracking, 18% VAT calculation, and RS.ge waybill reference.",
      simTitle: "RS.ge B2B Partner Request — Telavi Winery LLC",
      simSource: "REFERRAL",
    },
    {
      title: "Georgian Banking & IBANs",
      provider: "Bank of Georgia (BOG) · TBC Bank",
      status: "CONNECTED",
      icon: Landmark,
      desc: isKa
        ? "საქართველოს ბანკის და თიბისი ბანკის IBAN რეკვიზიტები ყველა ინვოისში + iPay / TPay მზადყოფნა."
        : "Automatic BOG (BAGAGE22) & TBC (TBCBGE22) IBAN details on every invoice + payment gateway adapter.",
      simTitle: "Website Checkout Inquiry — Zugdidi Retail Group",
      simSource: "WEBSITE",
    },
  ];

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
              ? "OMNICHANNEL · ქართული არხების და სერვისების ჰაბი"
              : "GEORGIAN OMNICHANNEL HUB · BITRIX24 CONTACT CENTER"}
          </span>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {isKa
              ? "კონტაქტ-ცენტრი და ქართული ინტეგრაციები"
              : "Contact Center & Georgian Business Integrations"}
          </h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {ctx.company.legalForm} {ctx.company.name} · ს/კ: {ctx.company.taxId ?? "405318921"}
          </p>
        </div>

        <Link href={`/${locale}/leads`} className="btn btn-primary">
          <Headset size={15} />
          <span>{isKa ? "ლიდების ინბოქსის გახსნა" : "Open Leads Inbox"}</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1.1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        {channels.map((ch) => {
          const Icon = ch.icon;
          return (
            <Surface
              key={ch.title}
              className="surface-interactive"
              style={{
                padding: "1.35rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div className="landing-card-icon">
                    <Icon size={18} />
                  </div>
                  <Badge tone={ch.status === "CONNECTED" || ch.status === "READY" ? "ok" : "warn"}>
                    {ch.status}
                  </Badge>
                </div>
                <h2 className="section-title" style={{ marginTop: "0.85rem", fontSize: "1.05rem" }}>
                  {ch.title}
                </h2>
                <div className="kicker" style={{ marginTop: 3 }}>
                  {ch.provider}
                </div>
                <p className="muted" style={{ margin: "0.55rem 0 0", fontSize: "0.86rem" }}>
                  {ch.desc}
                </p>
              </div>

              <form action={createLeadAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="title" value={ch.simTitle} />
                <input type="hidden" name="contactName" value="Levan Beridze" />
                <input type="hidden" name="companyName" value="შპს ქართული ბიზნეს ჯგუფი" />
                <input type="hidden" name="taxId" value="405991024" />
                <input type="hidden" name="phone" value="+995 599 77 88 99" />
                <input type="hidden" name="source" value={ch.simSource} />
                <input type="hidden" name="amount" value="3400" />
                <input
                  type="hidden"
                  name="notes"
                  value={`Simulated inbound event from ${ch.provider}`}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  style={{ width: "100%", justifyContent: "space-between", fontSize: "0.8rem" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Zap size={14} color="#10b981" />
                    {isKa ? "ტესტ-ლიდის სიმულაცია" : "Simulate Incoming Lead"}
                  </span>
                  <ArrowRight size={14} />
                </Button>
              </form>
            </Surface>
          );
        })}
      </div>

      <Surface style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={16} color="#38bdf8" />
          <strong style={{ color: "#fff" }}>
            {isKa
              ? "ვებსაიტის ფორმის ემბედი (Bitrix24 CRM Web Form)"
              : "Website Lead Capture Webhook"}
          </strong>
        </div>
        <p className="muted" style={{ margin: "0.45rem 0 0", fontSize: "0.84rem" }}>
          {isKa
            ? "ნებისმიერი ქართული ლენდინგიდან ან ვებსაიტიდან შემოსული განაცხადი პირდაპირ ხვდება ლიდების მოდულში ს/კ და ტელეფონის ველებით."
            : "Connect any Georgian landing page or e-commerce store directly to the Leads Inbox with automatic Tax ID (ს/კ) and phone capture."}
        </p>
      </Surface>
    </div>
  );
}
