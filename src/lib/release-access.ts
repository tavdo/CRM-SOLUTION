import { AppError } from "./errors";

export function isDatabaseRegistrationEnabled(env: Record<string, string | undefined> = process.env) {
  return env.DEPLOYMENT_MODE === "preview" && env.REGISTRATION_MODE === "database";
}

export function requiresVerifiedEmail() {
  return !isDatabaseRegistrationEnabled() && ["live", "preview"].includes(process.env.DEPLOYMENT_MODE || "");
}

export function previewEmailAllowed(email: string) {
  if (process.env.DEPLOYMENT_MODE !== "preview" || isDatabaseRegistrationEnabled()) return true;
  const allowed = (process.env.PREVIEW_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.length === 1 && allowed[0] === email.trim().toLowerCase();
}

export function requirePreviewEmail(email: string) {
  if (!previewEmailAllowed(email)) throw new AppError("Registration is not open yet", "PREVIEW_RESTRICTED", 403);
}
