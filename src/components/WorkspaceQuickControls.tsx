"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Globe, LayoutDashboard, SlidersHorizontal, SunMoon } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import styles from "./WorkspaceQuickControls.module.css";

type Props = {
  locale: string;
  dashboardLabel: string;
  controlsLabel?: string;
  onOpen?: () => void;
};

export function WorkspaceQuickControls({ locale, dashboardLabel, controlsLabel, onOpen }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeControl, setActiveControl] = useState<"language" | "theme" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const label = controlsLabel || (locale === "ka" ? "სამუშაო სივრცის მართვა" : "Workspace controls");
  const languageLabel = locale === "ka" ? "ენა" : "Language";
  const themeLabel = locale === "ka" ? "ფერის თემა" : "Color theme";
  const languageId = `${optionsId}-language`;
  const themeId = `${optionsId}-theme`;

  useEffect(() => { setOpen(false); setActiveControl(null); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false); setActiveControl(null);
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      setActiveControl(null);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveControl(null); }
    }}>
      {/* From Uiverse.io by Lucaasbre */}
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={optionsId}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
          setActiveControl(null);
        }}
      >
        <SlidersHorizontal size={22} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <div id={optionsId} className={styles.options} role="group" aria-label={label} hidden={!open}>
        {open ? (
          <>
            <div className={`${styles.row} ${styles.language}`}>
              <button type="button" className={styles.circle} aria-label={languageLabel}
                aria-expanded={activeControl === "language"} aria-controls={languageId}
                onClick={() => setActiveControl(activeControl === "language" ? null : "language")}>
                <Globe size={21} aria-hidden="true" />
              </button>
              <div id={languageId} className={styles.controls} hidden={activeControl !== "language"}>
                {activeControl === "language" ? <LanguageSwitcher locale={locale} /> : null}
              </div>
              {activeControl !== "language" ? <span className={styles.optionLabel}>{languageLabel}</span> : null}
            </div>
            <div className={`${styles.row} ${styles.theme}`}>
              <button type="button" className={styles.circle} aria-label={themeLabel}
                aria-expanded={activeControl === "theme"} aria-controls={themeId}
                onClick={() => setActiveControl(activeControl === "theme" ? null : "theme")}>
                <SunMoon size={22} aria-hidden="true" />
              </button>
              <div id={themeId} className={styles.controls} hidden={activeControl !== "theme"}>
                {activeControl === "theme" ? <ThemeSwitcher /> : null}
              </div>
              {activeControl !== "theme" ? <span className={styles.optionLabel}>{themeLabel}</span> : null}
            </div>
            <Link href={`/${locale}/dashboard`} className={`${styles.row} ${styles.dashboard}`} onClick={() => { setOpen(false); setActiveControl(null); }}>
              <span className={styles.circle} aria-hidden="true"><LayoutDashboard size={21} /></span>
              <span className={styles.optionLabel}>{dashboardLabel}</span>
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
