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
  return new TextEncoder().encode(secret || "local-development-session-secret");
}
