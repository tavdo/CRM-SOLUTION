"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Kanban, LayoutDashboard, Settings } from "lucide-react";
import styles from "./MobileBottomNav.module.css";

export type MobileBottomNavLabels = Record<"dashboard" | "deals" | "calendar" | "settings", string>;

export function MobileBottomNav({ locale, labels }: { locale: string; labels: MobileBottomNavLabels }) {
  const pathname = usePathname();
  const items = [
    { key: "dashboard", Icon: LayoutDashboard },
    { key: "deals", Icon: Kanban },
    { key: "calendar", Icon: CalendarDays },
    { key: "settings", Icon: Settings },
  ] as const;

  return (
    <nav
      className={styles.nav}
      aria-label={locale === "ka" ? "მთავარი ნავიგაცია" : "Primary navigation"}
      data-mobile-bottom-nav="true"
    >
      {items.map(({ key, Icon }) => {
        const href = `/${locale}/${key}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={key}
            href={href}
            className={styles.link}
            aria-current={active ? "page" : undefined}
            aria-label={labels[key]}
          >
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
            <span className={styles.label}>{labels[key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
