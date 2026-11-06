import { afterEach, describe, expect, it, vi } from "vitest";
import { productionProblems } from "../src/lib/production-config";
import { mailConfiguration } from "../src/lib/email";
import { isBlockedDemoAccount } from "../src/lib/auth/demo";
afterEach(() => vi.unstubAllEnvs());
describe("production safeguards", () => {
  it("rejects incomplete/demo deployment configuration without exposing secrets", () => {
    const problems = productionProblems({ DATABASE_URL: "file:./demo.db", SESSION_SECRET: "dev-secret-private" });
    expect(problems.some(x => x.includes("PostgreSQL"))).toBe(true);
    expect(problems.some(x => x.includes("SMTP"))).toBe(true);
    expect(JSON.stringify(problems)).not.toContain("dev-secret-private");
  });
  it("accepts a configured limited CRM release while keeping social messaging and payments disabled", () => {
    expect(productionProblems({ DEPLOYMENT_MODE: "live", DATABASE_URL: "postgresql://app:randompassword@db.host.test:6543/postgres?schema=crm", DIRECT_URL: "postgresql://app:randompassword@db.host.test:5432/postgres?schema=crm",
      SESSION_SECRET: "a-random-generated-value-longer-than-thirty-two-characters", APP_URL: "https://crm.host.test", SEED_DEMO_DATA: "false", EMAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.host.test", SMTP_USER: "mail", SMTP_PASS: "randompassword", SMTP_FROM: "CRM <mail@host.test>", FILE_STORAGE: "s3", S3_BUCKET: "private-crm", AWS_REGION: "eu-central-1", TRUSTED_IP_HEADER: "x-real-ip", BILLING_PROVIDER: "disabled", SUPPORT_EMAIL: "support@host.test", OPERATOR_NAME: "Test Operator" })).toEqual([]);
  });
  it("does not silently fall back to console when SMTP is selected without a host", () => {
    vi.stubEnv("EMAIL_TRANSPORT", "smtp"); vi.stubEnv("SMTP_HOST", "");
    expect(() => mailConfiguration()).toThrow("SMTP is not configured");
  });
  it("forbids console email and default accounts for a live release", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DEPLOYMENT_MODE", "live"); vi.stubEnv("EMAIL_TRANSPORT", "console");
    expect(() => mailConfiguration()).toThrow("Production email");
    expect(isBlockedDemoAccount("admin@crm.local")).toBe(true);
    expect(isBlockedDemoAccount("owner@host.test")).toBe(false);
  });
  it("uses implicit TLS on 465 and STARTTLS on 587 with remote content disabled", () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("EMAIL_TRANSPORT", "smtp"); vi.stubEnv("SMTP_HOST", "smtp.host.test"); vi.stubEnv("SMTP_PORT", "465");
    expect(mailConfiguration().options).toMatchObject({ secure: true, requireTLS: true, disableFileAccess: true, disableUrlAccess: true });
    vi.stubEnv("SMTP_PORT", "587"); expect(mailConfiguration().options?.secure).toBe(false);
  });
});
