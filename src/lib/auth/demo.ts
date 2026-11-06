const DEMO_EMAILS = new Set([
  "admin@crm.local", "manager@crm.local", "user@crm.local",
]);

export function canUseDemoLogin(email: string): boolean {
  return process.env.NODE_ENV !== "production" && DEMO_EMAILS.has(email);
}

export function sessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  if (process.env.NODE_ENV === "production" &&
      (!secret || secret.length < 32 || /change.me|local-development|demo.session|dev.secret/i.test(secret))) {
    throw new Error("SESSION_SECRET must contain at least 32 random characters in production");
  }
  return new TextEncoder().encode(secret || "local-development-session-secret");
}

export function isBlockedDemoAccount(email: string): boolean {
  return process.env.NODE_ENV === "production" && process.env.DEPLOYMENT_MODE !== "demo" &&
    (DEMO_EMAILS.has(email.toLowerCase()) || /^[^@]+@demo-(alpha|beta)\.local$/i.test(email));
}
