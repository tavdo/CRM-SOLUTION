import { parseWorkspaceDateTime, parseDateOnly, dateInTimezone } from "../src/lib/dates";
import { describe, expect, it } from "vitest";
import { isTaskOverdue } from "@/lib/dates";

describe("overdue tasks", () => {
  it("marks open tasks past due as overdue", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTaskOverdue("OPEN", past)).toBe(true);
  });

  it("does not mark done or undated tasks overdue", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTaskOverdue("DONE", past)).toBe(false);
    expect(isTaskOverdue("OPEN", null)).toBe(false);
  });
});


describe("workspace input date semantics", () => {
  it("interprets local deadlines in Tbilisi across the UTC day boundary", () => {
    expect(parseWorkspaceDateTime("2026-10-28T00:30", "Asia/Tbilisi").toISOString()).toBe("2026-10-27T20:30:00.000Z");
    expect(dateInTimezone(new Date("2026-10-27T20:30:00Z"), "Asia/Tbilisi")).toBe("2026-10-28");
    expect(parseDateOnly("2026-10-28").toISOString()).toBe("2026-10-28T00:00:00.000Z");
  });
  it("rejects invalid calendar days and nonexistent daylight-saving times", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow();
    expect(() => parseWorkspaceDateTime("2026-03-08T02:30", "America/New_York")).toThrow();
  });
});
