"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => window.print()}
    >
      <Printer size={15} />
      <span>{label}</span>
    </button>
  );
}
