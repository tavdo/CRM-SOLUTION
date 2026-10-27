import { describe, expect, it } from "vitest";
import { normalizePhone, normalizeText, samePhone } from "../src/lib/normalization";

describe("Georgian and international phone normalization", () => {
  it.each(["599123456", "0599 123 456", "+995 (599) 12-34-56", "00995599123456", "995599123456"])("normalizes %s", (input) => {
    expect(normalizePhone(input)).toBe("+995599123456");
  });
  it("handles Georgian landlines and preserves international country codes", () => {
    expect(normalizePhone("032 212 34 56")).toBe("+995322123456");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(samePhone("+995 599 123 456", "599123456")).toBe(true);
    expect(samePhone("+995599123456", "+449599123456")).toBe(false);
    expect(normalizePhone("")).toBeNull();
  });
  it.each(["+995123", "123", "+9955991234567", "599123456 ext 1", "++995599123456", "+01234567890"])("rejects malformed %s", (input) => {
    expect(() => normalizePhone(input)).toThrow();
  });
  it("normalizes Unicode without transliterating original names", () => {
    expect(normalizeText("  ქართული სახელი  ")).toBe("ქართული სახელი");
    expect(normalizeText("Cafe\u0301")).toBe("Café");
  });
});
