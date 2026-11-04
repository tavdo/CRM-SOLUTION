"use client";

import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import { LoadingIndicator } from "./LoadingIndicator";
import styles from "./LoadingIndicator.module.css";

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: string;
  submitLabel: string;
  loadingLabel?: string;
  submitStyle?: CSSProperties;
};

export function NativeSubmitForm({ children, submitLabel, loadingLabel, submitStyle, ...props }: Props) {
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const reset = () => { submitting.current = false; setPending(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      {...props}
      onSubmit={event => {
        if (event.defaultPrevented) return;
        if (submitting.current) { event.preventDefault(); return; }
        // Keep the browser's native POST, multipart encoding and redirect handling.
        submitting.current = true;
        setPending(true);
      }}
    >
      {children}
      <button
        type="submit"
        className={`btn btn-primary${pending ? ` ${styles.pendingButton}` : ""}`}
        style={submitStyle}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <span className={styles.buttonContent}>{submitLabel}</span>
            <span className={styles.buttonIndicator}><LoadingIndicator compact label={loadingLabel} /></span>
          </>
        ) : submitLabel}
      </button>
    </form>
  );
}
