import Link from "next/link";
import { Surface } from "./ui";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function AuthShell({
  title,
  brand,
  locale,
  children,
}: {
  title: string;
  brand: string;
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        padding: "1.25rem 1.5rem",
      }}
    >
      <header
        style={{
          maxWidth: 1120,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <Link href={`/${locale}`} className="app-brand-row" style={{ padding: 0 }}>
          <span className="app-brand-mark">CS</span>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>{brand}</span>
        </Link>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <ThemeSwitcher />
          <LanguageSwitcher locale={locale} />
        </div>
      </header>

      <div style={{ display: "grid", placeItems: "center", padding: "2rem 0" }}>
        <Surface
          className="rise"
          style={{
            width: "min(430px, 100%)",
            padding: "2rem 1.85rem",
          }}
        >
          <span className="kicker">{brand}</span>
          <h1 className="page-title" style={{ fontSize: "1.6rem", marginTop: "0.35rem", marginBottom: "1.35rem" }}>
            {title}
          </h1>
          {children}
        </Surface>
      </div>
    </div>
  );
}
