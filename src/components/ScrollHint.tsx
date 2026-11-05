"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import styles from "./ScrollHint.module.css";

export function ScrollHint({ locale }: { locale: string }) {
  const pathname = usePathname();
  const [hasMore, setHasMore] = useState(false);
  const visible = useRef(false);
  const isKa = locale === "ka";

  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const scrollingElement = document.scrollingElement;
      const next = Boolean(
        scrollingElement && scrollingElement.scrollHeight - scrollingElement.scrollTop - window.innerHeight > 24,
      );

      if (next !== visible.current) {
        visible.current = next;
        setHasMore(next);
      }
    };

    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(document.documentElement);
    if (document.body) observer?.observe(document.body);
    schedule();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  if (!hasMore) return null;

  return (
    <button
      type="button"
      className={styles.hint}
      data-scroll-hint="true"
      aria-label={isKa ? "ჩამოსქროლეთ მეტი ინფორმაციის სანახავად" : "Scroll down to see more content"}
      onClick={() => window.scrollBy({ top: Math.round(window.innerHeight * 0.65), behavior: "auto" })}
    >
      <span>{isKa ? "ქვემოთ მეტი" : "More below"}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}
