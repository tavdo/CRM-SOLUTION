"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { setLocalePreferenceAction } from "@/app/actions/auth";

export function LanguageSwitcher({ locale }: { locale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function onSwitch(next: "en" | "ka") {
    if (next === locale) return;
    const segments = pathname.split("/");
    segments[1] = next;
    await setLocalePreferenceAction(next);
    router.push(segments.join("/") || `/${next}`);
    router.refresh();
  }

  return (
    <div className="lang-pill" role="group" aria-label="Language">
      <Globe size={13} className="lang-pill-icon" />
      <button
        type="button"
        onClick={() => void onSwitch("en")}
        className={`lang-pill-btn ${locale === "en" ? "active" : ""}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => void onSwitch("ka")}
        className={`lang-pill-btn ${locale === "ka" ? "active" : ""}`}
      >
        ქარ
      </button>
    </div>
  );
}
