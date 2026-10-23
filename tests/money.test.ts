import { describe, expect, it } from "vitest";
import { fromMinor, sumByCurrency, toMinor } from "@/lib/money";

describe("money", () => {
  it("stores amounts as integer minor units", () => {
    expect(toMinor(12.34)).toBe(1234);
    expect(fromMinor(1234)).toBe(12.34);
  });

  it("sums separately by currency without FX", () => {
    expect(
      sumByCurrency([
        { amountMinor: 100, currency: "GEL" },
        { amountMinor: 50, currency: "USD" },
        { amountMinor: 25, currency: "GEL" },
      ]),
    ).toEqual({ GEL: 125, USD: 50 });
  });
});
