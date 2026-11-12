import { afterEach, describe, expect, it, vi } from "vitest";
import { isDatabaseRegistrationEnabled, previewEmailAllowed, requirePreviewEmail, requiresVerifiedEmail } from "../src/lib/release-access";
import { productionProblems } from "../src/lib/production-config";
afterEach(() => vi.unstubAllEnvs());
describe("restricted hosted preview", () => {
  it("opens accounts without verification only with an explicit database preview setting", () => {
    vi.stubEnv("DEPLOYMENT_MODE", "preview");
    vi.stubEnv("REGISTRATION_MODE", "database");
    expect(isDatabaseRegistrationEnabled()).toBe(true);
    expect(previewEmailAllowed("new-person@example.test")).toBe(true);
    expect(requiresVerifiedEmail()).toBe(false);
    vi.stubEnv("DEPLOYMENT_MODE", "live");
    expect(isDatabaseRegistrationEnabled()).toBe(false);
    expect(requiresVerifiedEmail()).toBe(true);
    expect(productionProblems(process.env)).toContain("Database-only registration is limited to preview deployments");
  });
  it("keeps verification and owner restrictions when the registration setting is misspelled", () => {
    vi.stubEnv("DEPLOYMENT_MODE", "preview");
    vi.stubEnv("PREVIEW_EMAILS", "owner@example.test");
    vi.stubEnv("REGISTRATION_MODE", "databse");
    expect(previewEmailAllowed("new-person@example.test")).toBe(false);
    expect(requiresVerifiedEmail()).toBe(true);
    expect(productionProblems(process.env)).toContain("REGISTRATION_MODE must be verified or database");
  });
  it("requires the database and security settings even when email delivery is disabled", () => {
    const problems = productionProblems({ DEPLOYMENT_MODE: "preview", REGISTRATION_MODE: "database" });
    expect(problems.some(value => /SMTP|PREVIEW_EMAILS|SUPPORT_EMAIL/.test(value))).toBe(false);
    expect(problems.some(value => value.includes("PostgreSQL"))).toBe(true);
    expect(problems.some(value => value.includes("SESSION_SECRET"))).toBe(true);
    expect(problems.some(value => value.includes("S3"))).toBe(true);
  });
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
