"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function WebformEmbedCopy({
  text,
  label,
  multiline = false,
}: {
  text: string;
  label: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.55rem" }}>
      {multiline ? (
        <textarea
          className="textarea"
          readOnly
          value={text}
          rows={4}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}
        />
      ) : null}
      <button type="button" className="btn btn-secondary" onClick={() => void onCopy()}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? "✓" : label}</span>
      </button>
    </div>
  );
}
