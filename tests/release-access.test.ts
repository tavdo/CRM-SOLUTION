import { afterEach, describe, expect, it, vi } from "vitest";
import { previewEmailAllowed, requirePreviewEmail, requiresVerifiedEmail } from "../src/lib/release-access";
import { productionProblems } from "../src/lib/production-config";
afterEach(() => vi.unstubAllEnvs());
describe("restricted hosted preview", () => {
  it("fails closed if the owner allowlist is absent or contains multiple recipients", () => {
    vi.stubEnv("DEPLOYMENT_MODE", "preview");
    vi.stubEnv("PREVIEW_EMAILS", ""); expect(previewEmailAllowed("owner@example.test")).toBe(false);
    vi.stubEnv("PREVIEW_EMAILS", "one@example.test,two@example.test"); expect(previewEmailAllowed("one@example.test")).toBe(false);
  });
  it("permits only the configured owner and still requires email verification", () => {
    vi.stubEnv("DEPLOYMENT_MODE", "preview"); vi.stubEnv("PREVIEW_EMAILS", "owner@example.test");
    expect(previewEmailAllowed("OWNER@example.test")).toBe(true);
    expect(() => requirePreviewEmail("stranger@example.test")).toThrow("Registration is not open yet");
    expect(requiresVerifiedEmail()).toBe(true);
  });
  it("keeps live-domain requirements while validating preview recipient restrictions", () => {
    const live = productionProblems({ DEPLOYMENT_MODE: "live", SMTP_FROM: "CRM <onboarding@resend.dev>" });
    expect(live.some(value => value.includes("test sender"))).toBe(true);
    expect(live.some(value => value.includes("SUPPORT_EMAIL"))).toBe(true);
    const preview = productionProblems({ DEPLOYMENT_MODE: "preview", SMTP_FROM: "CRM <onboarding@resend.dev>", PREVIEW_EMAILS: "owner@example.test" });
    expect(preview.some(value => value.includes("test sender") || value.includes("SUPPORT_EMAIL") || value.includes("PREVIEW_EMAILS"))).toBe(false);
    expect(preview.some(value => value.includes("PostgreSQL"))).toBe(true);
  });
});
