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
