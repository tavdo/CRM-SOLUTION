"use client";

import { useParams } from "next/navigation";
import { LoadingIndicator } from "./LoadingIndicator";
import styles from "./RouteLoading.module.css";

export function RouteLoading({ fullPage = false }: { fullPage?: boolean }) {
  const locale = useParams()?.locale;
  const isKa = locale === "ka";

  return (
    <div
      className={`${styles.loading} ${fullPage ? styles.fullPage : ""}`}
      lang={isKa ? "ka" : "en"}
      aria-busy="true"
      data-route-loading="true"
    >
      <LoadingIndicator label={isKa ? "იტვირთება…" : "Loading…"} />
    </div>
  );
}
