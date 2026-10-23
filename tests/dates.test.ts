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
