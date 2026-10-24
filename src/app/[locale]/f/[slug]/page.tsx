import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/db-init";
import { isLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function PublicLeadFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await ensureDbInitialized();

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) notFound();

  const isKa = locale === "ka";
  const sent = sp.sent;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem 1rem",
        background:
          "radial-gradient(ellipse at top, rgba(16,185,129,0.12), transparent 55%), #070b12",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          padding: "1.75rem",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(12, 18, 28, 0.92)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ marginBottom: "1.1rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span className="app-brand-mark">CS</span>
            <strong style={{ color: "#fff" }}>{company.name}</strong>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.35rem", color: "#fff" }}>
            {isKa ? "დაგვიკავშირდით" : "Contact us"}
          </h1>
          <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.88rem" }}>
            {isKa
              ? "შეავსეთ ფორმა — მოთხოვნა პირდაპირ ლიდების ინბოქსში მოხვდება."
              : "Submit this form — it lands in the Leads inbox."}
          </p>
        </div>

        {sent ? (
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: 12,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)",
              color: "#a7f3d0",
              marginBottom: "1rem",
              fontSize: "0.9rem",
            }}
          >
            {sent === "duplicate"
              ? isKa
                ? "თქვენი მოთხოვნა უკვე მიღებულია — განვაახლეთ შენიშვნა."
                : "We already have your inquiry — notes were updated."
              : isKa
                ? "მადლობა! მოთხოვნა მიღებულია."
                : "Thanks! Your inquiry was received."}
          </div>
        ) : null}

        <form
          action="/api/inbound/webform"
          method="post"
          style={{ display: "grid", gap: "0.75rem" }}
        >
          <input type="hidden" name="companySlug" value={company.slug} />
          <input
            type="hidden"
            name="redirectTo"
            value={`/${locale}/f/${company.slug}`}
          />
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              {isKa ? "სახელი *" : "Name *"}
            </span>
            <input className="input" name="contactName" required />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              {isKa ? "ელფოსტა" : "Email"}
            </span>
            <input className="input" type="email" name="email" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              {isKa ? "ტელეფონი" : "Phone"}
            </span>
            <input className="input" name="phone" placeholder="+995 5…" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              {isKa ? "კომპანია" : "Company"}
            </span>
            <input className="input" name="companyName" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              {isKa ? "შეტყობინება" : "Message"}
            </span>
            <textarea className="textarea" name="message" rows={4} />
          </label>
          <button type="submit" className="btn btn-primary" style={{ minHeight: 42 }}>
            {isKa ? "გაგზავნა" : "Send inquiry"}
          </button>
        </form>
      </div>
    </div>
  );
}
