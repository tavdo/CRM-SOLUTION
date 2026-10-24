import { Zap, Shield, Briefcase, UserCheck, Globe2, ArrowUpRight } from "lucide-react";

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
        padding: compact ? "1rem" : "1.15rem 1.25rem",
        border: "1px solid rgba(16, 185, 129, 0.28)",
        background:
          "linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(9, 14, 23, 0.88) 100%)",
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
          <Zap size={13} />
          {isKa
            ? "სწრაფი დემო შესვლა — რეგისტრაციის გარეშე"
            : "Instant Owner Demo — 1-Click Login"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.55rem",
          gridTemplateColumns: compact
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(2, minmax(0, 1fr))",
        }}
      >
        {personas.map((p) => {
          const Icon = p.icon;
          const href = `/api/demo-login?email=${encodeURIComponent(p.email)}&locale=${encodeURIComponent(p.targetLocale)}`;
          return (
            <a
              key={p.email}
              href={href}
              className="surface-interactive"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.65rem",
                padding: "0.65rem 0.85rem",
                borderRadius: 12,
                background: p.primary
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.12) 100%)"
                  : "rgba(255, 255, 255, 0.04)",
                border: p.primary
                  ? "1px solid rgba(16, 185, 129, 0.48)"
                  : "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    background: p.primary
                      ? "rgba(16, 185, 129, 0.25)"
                      : "rgba(255, 255, 255, 0.06)",
                    color: p.primary ? "#6ee7b7" : "#cbd5e1",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} />
                </span>
                <span style={{ display: "grid", lineHeight: 1.2 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>
                    {p.title}
                  </span>
                  <span className="muted" style={{ fontSize: "0.7rem" }}>
                    {p.sub}
                  </span>
                </span>
              </span>
              <ArrowUpRight size={14} className="muted" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
