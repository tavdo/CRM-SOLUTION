"use client";

import { usePathname, useRouter } from "next/navigation";
import { setLocalePreferenceAction } from "@/app/actions/auth";

export function LanguageSwitcher({ locale }: { locale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function onChange(next: string) {
    const segments = pathname.split("/");
    segments[1] = next;
    await setLocalePreferenceAction(next as "en" | "ka");
    router.push(segments.join("/") || `/${next}`);
    router.refresh();
  }

  return (
    <select
      className="select"
      aria-label="Language"
      style={{ width: "auto", padding: "0.4rem 0.55rem" }}
      value={locale}
      onChange={(e) => void onChange(e.target.value)}
    >
      <option value="en">EN</option>
      <option value="ka">ქარ</option>
    </select>
  );
}
