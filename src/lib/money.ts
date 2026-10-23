/** Store money as integer minor units. Totals are reported per currency (no FX). */

export function toMinor(amount: number | string, fractionDigits = 2): number {
  const n = typeof amount === "string" ? Number(amount.replace(",", ".")) : amount;
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 10 ** fractionDigits);
}

export function fromMinor(minor: number, fractionDigits = 2): number {
  return minor / 10 ** fractionDigits;
}

export function formatMoney(
  minor: number,
  currency: string,
  locale: string,
  fractionDigits = 2,
): string {
  try {
    return new Intl.NumberFormat(locale === "ka" ? "ka-GE" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(fromMinor(minor, fractionDigits));
  } catch {
    return `${fromMinor(minor, fractionDigits).toFixed(fractionDigits)} ${currency}`;
  }
}

export function sumByCurrency(
  items: { amountMinor: number; currency: string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    out[item.currency] = (out[item.currency] ?? 0) + item.amountMinor;
  }
  return out;
}
