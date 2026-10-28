"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const STORAGE_KEY = "crm-theme";
const CHANGE_EVENT = "crm-theme-change";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === "light" ? "light" : "dark";
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function selectTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* The selection still works when storage is unavailable. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeSwitcher() {
  const t = useTranslations("theme");
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "dark" as const);
  return (
    <div className="theme-switcher" role="group" aria-label={t("label")}>
      <button type="button" className="theme-option" aria-pressed={theme === "light"} onClick={() => selectTheme("light")}>
        <Sun size={14} aria-hidden="true" /><span>{t("day")}</span>
      </button>
      <button type="button" className="theme-option" aria-pressed={theme === "dark"} onClick={() => selectTheme("dark")}>
        <Moon size={14} aria-hidden="true" /><span>{t("night")}</span>
      </button>
    </div>
  );
}
