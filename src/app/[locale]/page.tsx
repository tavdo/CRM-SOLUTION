import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { HardHat, ClipboardCheck, ShieldCheck, Languages, ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { QuickDemoLogin } from "@/components/QuickDemoLogin";
import { isLocale } from "@/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/ka");
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const b = await getTranslations("brand");
  const c = await getTranslations("construction");
  const user = await getSessionUser();
  return <div className="landing"><header className="landing-nav"><div className="landing-nav-inner"><Link className="landing-brand" href={`/${locale}`}><span className="app-brand-mark"><HardHat size={21} /></span>{b("name")}</Link><div className="landing-nav-actions"><ThemeSwitcher /><LanguageSwitcher locale={locale} /><Link href={`/${locale}/${user ? "projects" : "sign-in"}`} className="btn btn-secondary">{user ? c("projects") : t("signin")}</Link></div></div></header><main><section className="contractor-hero"><div><span className="kicker">{b("tagline")}</span><h1 className="landing-title">{t("headline")}</h1><p className="landing-subtitle">{t("heroBody")}</p><div className="construction-row"><Link href={`/${locale}/sign-up`} className="btn btn-primary">{t("cta")} <ArrowRight size={16} /></Link><Link href={`/${locale}/sign-in`} className="btn btn-secondary">{t("signin")}</Link></div><QuickDemoLogin locale={locale} /></div><div className="surface construction-panel contractor-flow"><HardHat size={42} /><h2>{t("workflowTitle")}</h2><p>{t("workflowBody")}</p><div className="construction-grid">{["estimates", "work", "materials", "finance"].map((key) => <div key={key} className="construction-item"><ClipboardCheck size={20} /><strong>{c(key)}</strong></div>)}</div></div></section><section className="landing-bento">{[{ title: "workflowTitle", body: "workflowBody", Icon: ClipboardCheck }, { title: "bilingualTitle", body: "bilingualBody", Icon: Languages }, { title: "rolesTitle", body: "rolesBody", Icon: ShieldCheck }].map(({ title, body, Icon }) => <div className="landing-card" key={title}><Icon size={24} /><h2 className="section-title">{t(title)}</h2><p className="muted">{t(body)}</p></div>)}</section><section className="contractor-cta surface"><h2>{t("finalTitle")}</h2><p className="muted">{t("finalBody")}</p><Link className="btn btn-primary" href={`/${locale}/sign-up`}>{t("cta")}</Link></section></main><footer className="landing-footer">{t("footerNote")}</footer></div>;
}
