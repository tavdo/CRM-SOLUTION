import { AppError } from "./errors";

/**
 * Overdue: an OPEN task with dueAt strictly before the start of "now"
 * in the company's timezone (compared via absolute Instant).
 * We store all timestamps in UTC; display converts to company/user TZ.
 */

export function isTaskOverdue(
  status: "OPEN" | "DONE",
  dueAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status !== "OPEN" || !dueAt) return false;
  return dueAt.getTime() < now.getTime();
}

export function formatDateTime(
  date: Date | null | undefined,
  locale: string,
  timeZone: string,
): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatDate(
  date: Date | null | undefined,
  locale: string,
  timeZone: string,
): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-US", {
      dateStyle: "medium",
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Date-only values retain their calendar day regardless of display timezone. */
export function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError("Invalid date", "INVALID_DATE", 400);
  }
  return date;
}

/** Interpret a datetime-local input in the company timezone, never the host timezone. */
export function parseWorkspaceDateTime(value: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new AppError("Invalid date", "INVALID_DATE", 400);
  parseDateOnly(value.slice(0, 10));
  const wallTime = new Date(`${value}:00.000Z`).getTime();
  if (!Number.isFinite(wallTime)) throw new AppError("Invalid date", "INVALID_DATE", 400);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  let instant = wallTime;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
    const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    if (local === value) return new Date(instant);
    const offset = new Date(`${local}:00.000Z`).getTime() - instant;
    instant = wallTime - offset;
  }
  throw new AppError("Invalid local date or time", "INVALID_DATE", 400);
}

export function dateInTimezone(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
