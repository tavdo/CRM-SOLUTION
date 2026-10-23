import { Zap, Shield, Briefcase, UserCheck, Globe2 } from "lucide-react";
import { demoLoginAction } from "@/app/actions/auth";

export function QuickDemoLogin({
  locale,
  compact = false,
}: {
  locale: string;
  compact?: boolean;
}) {
  const isKa = locale === "ka";

  const personas = [
    {
      email: "admin@demo-alpha.local",
      targetLocale: "en",
      title: isKa ? "Alpha ადმინი (EN)" : "Alpha Admin (EN)",
      sub: isKa ? "სრული მართვა · 5 გარიგება" : "Full workspace · 5 deals",
      icon: Shield,
      primary: true,
    },
    {
      email: "admin@demo-beta.local",
      targetLocale: "ka",
      title: isKa ? "ბეტა ადმინი (ქარ)" : "Beta Admin (ქარ)",
      sub: isKa ? "ქართული სამუშაო სივრცე" : "Georgian workspace",
      icon: Globe2,
      primary: false,
    },
    {
      email: "manager@demo-alpha.local",
      targetLocale: locale,
      title: isKa ? "გაყიდვების მენეჯერი" : "Sales Manager",
      sub: isKa ? "მთელი მილი და დავალებები" : "All CRM & pipeline",
      icon: Briefcase,
      primary: false,
    },
    {
      email: "employee@demo-alpha.local",
      targetLocale: locale,
      title: isKa ? "თანამშრომელი" : "Sales Rep (Employee)",
      sub: isKa ? "მხოლოდ საკუთარი ჩანაწერები" : "Own assigned records only",
      icon: UserCheck,
      primary: false,
    },
  ];

  return (
    <div
      className="surface"
      style={{
        padding: compact ? "1rem" : "1.25rem 1.35rem",
        border: "1px solid rgba(16, 185, 129, 0.35)",
        background:
          "linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, rgba(9, 14, 23, 0.88) 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <span
          className="kicker"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Zap size={14} />
          {isKa
            ? "სწრაფი დემო შესვლა — რეგისტრაციის გარეშე"
            : "Instant Owner Demo — 1-Click Login (No Registration)"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.55rem",
          gridTemplateColumns: compact
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(auto-fit, minmax(175px, 1fr))",
        }}
      >
        {personas.map((p) => {
          const Icon = p.icon;
          return (
            <form key={p.email} action={demoLoginAction}>
              <input type="hidden" name="email" value={p.email} />
              <input type="hidden" name="locale" value={p.targetLocale} />
              <button
                type="submit"
                className={`btn ${p.primary ? "btn-primary" : "btn-secondary"}`}
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  padding: "0.6rem 0.8rem",
                  height: "100%",
                }}
              >
                <Icon size={16} />
                <span style={{ display: "grid", lineHeight: 1.2 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{p.title}</span>
                  <span
                    style={{
                      fontSize: "0.69rem",
                      opacity: 0.78,
                      fontWeight: 500,
                    }}
                  >
                    {p.sub}
                  </span>
                </span>
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
