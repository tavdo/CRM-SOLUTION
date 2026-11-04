import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { HardHat, ClipboardCheck, ShieldCheck, Languages, ArrowRight, Ruler, Package, Wallet } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { QuickDemoLogin } from "@/components/QuickDemoLogin";
import { isLocale } from "@/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
import type { CSSProperties } from "react";
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/ka");
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const b = await getTranslations("brand");
  const c = await getTranslations("construction");
  const nav = await getTranslations("nav");
  const user = await getSessionUser();
  const workflow = [
    { key: "estimates", Icon: Ruler, color: "#09b4ed" },
    { key: "work", Icon: HardHat, color: "#1ac4db" },
    { key: "materials", Icon: Package, color: "#7495ec" },
    { key: "finance", Icon: Wallet, color: "#9d82df" },
  ];

  return (
    <div className="landing crm-workspace landing-workspace">
      <a className="workspace-skip-link" href="#landing-content">{locale === "ka" ? "შინაარსზე გადასვლა" : "Skip to content"}</a>
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link className="workspace-brand-name" href={`/${locale}`}>{b("name")}<span>°</span></Link>
          <div className="landing-nav-actions">
            <ThemeSwitcher />
            <LanguageSwitcher locale={locale} />
            <Link href={`/${locale}/${user ? "dashboard" : "sign-in"}`} className="btn btn-secondary">{user ? nav("dashboard") : t("signin")}</Link>
          </div>
        </div>
      </header>
      <main id="landing-content">
        <section className="contractor-hero">
          <div className="landing-intro">
            <span className="kicker">{b("tagline")}</span>
            <h1 className="landing-title">{t("headline")}</h1>
            <p className="landing-subtitle">{t("heroBody")}</p>
            <div className="landing-cta">
              <Link href={`/${locale}/sign-up`} className="btn btn-primary">{t("cta")} <ArrowRight size={16} /></Link>
              <Link href={`/${locale}/sign-in`} className="btn btn-secondary">{t("signin")}</Link>
            </div>
            <QuickDemoLogin locale={locale} appearance="workspace" />
          </div>
          <div className="surface contractor-flow">
            <div className="overview-panel-header"><h2>{t("workflowTitle")}</h2><HardHat size={21} aria-hidden="true" /></div>
            <div className="landing-workflow-body">
              <p>{t("workflowBody")}</p>
              <div className="landing-workflow-grid">
                {workflow.map(({ key, Icon, color }) => (
                  <div key={key} className="landing-workflow-item" style={{ "--stage-color": color } as CSSProperties}>
                    <div className="landing-workflow-icon"><Icon size={24} aria-hidden="true" /></div>
                    <strong>{c(key)}</strong>
                  </div>
                ))}
              </div>
              <Link href={`/${locale}/${user ? "dashboard" : "sign-up"}`} className="landing-workflow-link">
                {user ? nav("dashboard") : t("cta")}<ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
        <section className="landing-bento">
          {[
            { title: "workflowTitle", body: "workflowBody", Icon: ClipboardCheck, color: "#14b5e7" },
            { title: "bilingualTitle", body: "bilingualBody", Icon: Languages, color: "#a28be8" },
            { title: "rolesTitle", body: "rolesBody", Icon: ShieldCheck, color: "#34c1af" },
          ].map(({ title, body, Icon, color }) => (
            <div className="landing-card surface" key={title} style={{ "--metric-color": color } as CSSProperties}>
              <Icon size={23} aria-hidden="true" /><h2>{t(title)}</h2><p className="muted">{t(body)}</p>
            </div>
          ))}
        </section>
        <section className="contractor-cta surface">
          <div><h2>{t("finalTitle")}</h2><p className="muted">{t("finalBody")}</p></div>
          <Link className="btn btn-primary" href={`/${locale}/sign-up`}>{t("cta")}<ArrowRight size={16} /></Link>
        </section>
      </main>
      <footer className="landing-footer"><span>{t("footerNote")}</span><span>© {new Date().getFullYear()} {b("name")}</span></footer>
    </div>
  );
}
