import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Users, UserPlus, Kanban, ArrowRight } from "lucide-react";
import { Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { isLocale } from "@/i18n/config";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("onboarding");

  const steps = [
    {
      num: "01",
      title: t("ctaCustomers"),
      href: `/${locale}/customers/new`,
      icon: Users,
      primary: true,
    },
    {
      num: "02",
      title: t("ctaInvite"),
      href: `/${locale}/settings`,
      icon: UserPlus,
      primary: false,
    },
    {
      num: "03",
      title: t("ctaPipeline"),
      href: `/${locale}/deals`,
      icon: Kanban,
      primary: false,
    },
  ];

  return (
    <div className="rise" style={{ display: "grid", gap: "1.5rem", maxWidth: 860 }}>
      <div>
        <span className="kicker">{ctx.company.name}</span>
        <h1 className="page-title" style={{ marginTop: 4 }}>
          {t("title")}
        </h1>
        <p className="muted" style={{ margin: "0.45rem 0 0", fontSize: "0.98rem", maxWidth: "58ch" }}>
          {t("body")}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <Surface
              key={s.num}
              className="surface-interactive"
              style={{
                padding: "1.35rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="kicker">{s.num}</span>
                <Icon size={18} color="#10b981" />
              </div>
              <Link
                href={s.href}
                className={`btn ${s.primary ? "btn-primary" : "btn-secondary"}`}
                style={{ justifyContent: "space-between" }}
              >
                <span>{s.title}</span>
                <ArrowRight size={15} />
              </Link>
            </Surface>
          );
        })}
      </div>
    </div>
  );
}
