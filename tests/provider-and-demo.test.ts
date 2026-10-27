import { afterEach, describe, expect, it, vi } from "vitest";
import { bankAccountProvider, billingProvider, emailProvider, isSupportedAutomationAction, rsGeProvider, smsProvider } from "../src/lib/providers";
import { canUseDemoLogin, sessionSecret } from "../src/lib/auth/demo";
import { GET as demoLogin } from "../src/app/api/demo-login/route";
import { NextRequest } from "next/server";

afterEach(() => vi.unstubAllEnvs());

describe("honest provider states", () => {
  it("never treats stored bank or RS references as verified connections", () => {
    expect(bankAccountProvider("GE00EXAMPLE").state).toBe("not_configured");
    expect(rsGeProvider(true).state).toBe("not_configured");
    expect(smsProvider().state).toBe("unavailable");
    expect(isSupportedAutomationAction("SEND_SMS")).toBe(false);
  });
  it("marks demo billing and console email explicitly", () => {
    vi.stubEnv("BILLING_PROVIDER", "dev");
    vi.stubEnv("EMAIL_TRANSPORT", "console");
    expect(billingProvider().state).toBe("demo");
    expect(emailProvider().state).toBe("demo");
    vi.stubEnv("BILLING_PROVIDER", "stripe");
    expect(billingProvider().state).toBe("not_configured");
  });
});

describe("demo authentication gate", () => {
  it("allows only fixed development demo identities", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(canUseDemoLogin("admin@demo-alpha.local")).toBe(true);
    expect(canUseDemoLogin("real-customer@example.com")).toBe(false);
  });
  it("rejects production demo requests before database access", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(canUseDemoLogin("admin@demo-alpha.local")).toBe(false);
    expect((await demoLogin(new NextRequest("http://localhost/api/demo-login?email=admin@demo-alpha.local"))).status).toBe(404);
  });
  it("rejects an arbitrary account in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await demoLogin(new NextRequest("http://localhost/api/demo-login?email=real@example.com"))).status).toBe(404);
  });
  it("requires an explicit production session secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => sessionSecret()).toThrow("SESSION_SECRET is required");
  });
});
