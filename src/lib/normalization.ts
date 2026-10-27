import { AppError } from "./errors";

/** NFC only: preserve Georgian spelling and case; no unvalidated transliteration. */
export function normalizeText(value: string): string {
  return value.normalize("NFC").trim();
}

/** Syntactic validation, not proof a number is assigned or reachable. */
export function normalizePhone(value: string | null | undefined): string | null {
  const input = value?.normalize("NFKC").trim();
  if (!input) return null;
  if (!/^[+\d\s().-]+$/.test(input)) throw new AppError("Invalid phone number", "INVALID_PHONE", 400);
  let phone = input.replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (/^0[1-9]\d{8}$/.test(phone)) phone = phone.slice(1);
  if (/^[1-9]\d{8}$/.test(phone)) phone = `+995${phone}`;
  if (/^995[1-9]\d{8}$/.test(phone)) phone = `+${phone}`;
  if (!/^\+[1-9]\d{6,14}$/.test(phone) || (phone.startsWith("+995") && !/^\+995[1-9]\d{8}$/.test(phone))) {
    throw new AppError("Invalid phone number", "INVALID_PHONE", 400);
  }
  return phone;
}

/** Legacy comparisons are safe to use before a separately reviewed data backfill. */
export function samePhone(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  try { return normalizePhone(a) === normalizePhone(b); } catch { return false; }
}
