import { describe, expect, it } from "vitest";
import { csvCell, csvDocument } from "../src/lib/csv";

describe("spreadsheet-safe CSV encoding", () => {
  it.each(["=HYPERLINK(\"https://example.invalid\")", "+1+1", "-1+1", "@SUM(A1)", "  =1+1", "\t=1+1", "\rcontent", "\ncontent"])("neutralizes %j", (value) => {
    expect(csvCell(value).startsWith('"\'')).toBe(true);
  });
  it("preserves Georgian and escapes quotes and multiline text", () => {
    const csv = csvDocument(["name"], [['ქართული, "სახელი"\nმეორე ხაზი']]);
    expect(csv).toBe('\uFEFF"name"\r\n"ქართული, ""სახელი""\nმეორე ხაზი"\r\n');
    expect(new TextDecoder().decode(new TextEncoder().encode(csv))).toContain("ქართული");
  });
});
