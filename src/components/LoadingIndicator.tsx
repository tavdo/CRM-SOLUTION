import styles from "./LoadingIndicator.module.css";

export function LoadingIndicator({ label = "Loading…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <span
      className={`${styles.indicator}${compact ? ` ${styles.compact}` : ""}`}
      data-loading-indicator="true"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
    >
      {/* From Uiverse.io by satyamchaudharydev */}
      <span className={styles.canvas} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
      </span>
      <span className={styles.screenReader}>{label}</span>
    </span>
  );
}
