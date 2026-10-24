import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Kanban,
  Globe2,
  CheckCircle2,
  Sparkles,
  Users,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QuickDemoLogin } from "@/components/QuickDemoLogin";
import { Badge } from "@/components/ui";
import { isLocale } from "@/i18n/config";
import { getSessionUser } from "@/lib/auth/session";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const brand = await getTranslations("brand");
  const nav = await getTranslations("nav");
  const user = await getSessionUser();

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href={`/${locale}`} className="landing-brand">
            <span className="app-brand-mark">CS</span>
            <span>{brand("name")}</span>
          </Link>
          <div className="landing-nav-actions">
            <LanguageSwitcher locale={locale} />
            {user ? (
              <Link href={`/${locale}/dashboard`} className="btn btn-primary">
                {nav("dashboard")}
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link href={`/${locale}/sign-in`} className="btn btn-secondary">
                  {t("signin")}
                </Link>
                <Link href={`/${locale}/sign-up`} className="btn btn-primary hide-mobile">
                  {t("cta")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="landing-hero-wrap" aria-label="Hero">
        <div className="rise">
          <span className="landing-pill">
            <Sparkles size={13} />
            {brand("tagline")}
          </span>
          <h1 className="landing-title">{t("headline")}</h1>
          <p className="landing-subtitle">{t("heroBody")}</p>
          <div className="landing-cta">
            <Link href={`/${locale}/sign-up`} className="btn btn-primary" style={{ minHeight: 44, padding: "0.7rem 1.35rem", fontSize: "0.9rem" }}>
              <span>{t("cta")}</span>
              <ArrowRight size={16} />
            </Link>
            <Link href={`/${locale}/sign-in`} className="btn btn-secondary" style={{ minHeight: 44, padding: "0.7rem 1.25rem", fontSize: "0.9rem" }}>
              {t("signin")}
            </Link>
          </div>

          <div style={{ marginTop: "1.4rem" }}>
            <QuickDemoLogin locale={locale} />
          </div>

          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              gap: "1.25rem",
              flexWrap: "wrap",
              color: "var(--ink-muted)",
              fontSize: "0.82rem",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={15} color="#10b981" /> {t("step1")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={15} color="#10b981" /> {t("step2")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={15} color="#10b981" /> {t("step3")}
            </span>
          </div>
        </div>

        {/* Live Command Center Preview Mockup */}
        <div className="landing-preview rise rise-delay-1" aria-hidden="true">
          <div className="landing-preview-top">
            <div className="landing-dots">
              <span />
              <span />
              <span />
            </div>
            <Badge tone="ok">LIVE PIPELINE · GEL / USD</Badge>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.65rem", marginBottom: "0.95rem" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", borderRadius: 11, padding: "0.75rem" }}>
              <div className="muted" style={{ fontSize: "0.7rem" }}>PIPELINE VALUE</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff", marginTop: 4 }}>48,500 GEL</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", borderRadius: 11, padding: "0.75rem" }}>
              <div className="muted" style={{ fontSize: "0.7rem" }}>ACTIVE DEALS</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#10b981", marginTop: 4 }}>14 OPEN</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", borderRadius: 11, padding: "0.75rem" }}>
              <div className="muted" style={{ fontSize: "0.7rem" }}>WON THIS MONTH</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff", marginTop: 4 }}>6 DEALS</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.65rem" }}>
            {[
              { col: "New", title: "Kura Logistics ERP", meta: "18,000 GEL · Nino B.", badge: "OPEN" },
              { col: "Qualified", title: "Tbilisi Retail POS", meta: "12,500 GEL · Giorgi M.", badge: "QUALIFIED" },
              { col: "Proposal", title: "Cloud Migration", meta: "18,000 GEL · Due 2d", badge: "WON" },
            ].map((item) => (
              <div
                key={item.col}
                style={{
                  background: "rgba(8, 11, 16, 0.75)",
                  border: "1px solid var(--line)",
                  borderRadius: 11,
                  padding: "0.7rem",
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                  {item.col}
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--line)",
                    borderRadius: 9,
                    padding: "0.65rem",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#fff" }}>{item.title}</div>
                  <div className="muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>{item.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-bento">
        <div className="landing-card">
          <div className="landing-card-icon">
            <Kanban size={18} />
          </div>
          <h2 className="section-title" style={{ fontSize: "1.1rem" }}>{t("workflowTitle")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("workflowBody")}</p>
        </div>

        <div className="landing-card">
          <div className="landing-card-icon">
            <Globe2 size={18} />
          </div>
          <h2 className="section-title" style={{ fontSize: "1.1rem" }}>{t("bilingualTitle")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("bilingualBody")}</p>
        </div>

        <div className="landing-card">
          <div className="landing-card-icon">
            <ShieldCheck size={18} />
          </div>
          <h2 className="section-title" style={{ fontSize: "1.1rem" }}>{t("rolesTitle")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("rolesBody")}</p>
        </div>
      </section>

      <section style={{ maxWidth: 1220, margin: "0 auto", padding: "0 1.5rem 4.5rem" }}>
        <div
          className="surface"
          style={{
            padding: "2.5rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.5rem",
            flexWrap: "wrap",
            background:
              "radial-gradient(600px 260px at 95% 50%, rgba(16, 185, 129, 0.18), transparent 70%), linear-gradient(180deg, #111823 0%, #0b1018 100%)",
          }}
        >
          <div>
            <span className="kicker" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Users size={13} /> MULTI-TENANT SAAS
            </span>
            <h2 className="page-title" style={{ marginTop: 6 }}>{t("finalTitle")}</h2>
            <p className="muted" style={{ margin: "0.45rem 0 0", maxWidth: "54ch" }}>
              {t("finalBody")}
            </p>
          </div>
          <Link href={`/${locale}/sign-up`} className="btn btn-primary" style={{ padding: "0.75rem 1.35rem" }}>
            <span>{t("cta")}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span>{t("footerNote")}</span>
        <div className="landing-nav-actions">
          <LanguageSwitcher locale={locale} />
          <Link href={`/${locale}/sign-in`}>{t("signin")}</Link>
        </div>
      </footer>
    </div>
  );
}
