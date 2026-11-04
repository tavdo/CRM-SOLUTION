import Link from "next/link";
import { Surface } from "./ui";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { BrandLogo } from "./BrandLogo";
import styles from "./AuthShell.module.css";

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
    <div className={`crm-workspace auth-workspace ${styles.shell}`}>
      <header className={styles.header}>
        <Link href={`/${locale}`} className={styles.brand}>
          <BrandLogo name={brand} />
        </Link>
        <div className={styles.controls}>
          <ThemeSwitcher />
          <LanguageSwitcher locale={locale} />
        </div>
      </header>

      <main className={styles.main}>
        <Surface className={styles.card}>
          <span className="kicker">{brand}</span>
          <h1 className={styles.title}>
            {title}
          </h1>
          {children}
        </Surface>
      </main>
    </div>
  );
}
