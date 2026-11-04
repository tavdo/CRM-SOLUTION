"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { LoadingIndicator } from "./LoadingIndicator";
import styles from "./LoadingIndicator.module.css";

export function PendingButton({ children, type = "submit", disabled, className, ...props }: ComponentProps<"button">) {
  const { pending } = useFormStatus();
  const busy = type === "submit" && pending;

  return (
    <button
      {...props}
      type={type}
      className={`${className || ""}${busy ? ` ${styles.pendingButton}` : ""}`.trim() || undefined}
      disabled={disabled || busy}
      aria-busy={busy || props["aria-busy"]}
    >
      {busy ? (
        <>
          <span className={styles.buttonContent}>{children}</span>
          <span className={styles.buttonIndicator}><LoadingIndicator compact /></span>
        </>
      ) : children}
    </button>
  );
}
