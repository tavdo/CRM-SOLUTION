import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("handles latin and empty input", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("")).toBe("company");
  });

  it("keeps uniqueness suffix", () => {
    expect(uniqueSlug("Acme", "abcdef12")).toContain("acme-");
  });
});
