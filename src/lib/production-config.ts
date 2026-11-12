import { isDatabaseRegistrationEnabled } from "./release-access";

type Environment = Record<string, string | undefined>;
const placeholder = (value = "") => !value || /change.me|replace.me|example\.(com|invalid)|your[-_]|demo.session|dev.secret|local-development/i.test(value);

/** Pure validation: never returns secret values and never contacts a service. */
export function productionProblems(env: Environment): string[] {
  const problems: string[] = [];
  const preview = env.DEPLOYMENT_MODE === "preview";
  const databaseRegistration = isDatabaseRegistrationEnabled(env);
  if (env.REGISTRATION_MODE && !["verified", "database"].includes(env.REGISTRATION_MODE)) problems.push("REGISTRATION_MODE must be verified or database");
  if (env.REGISTRATION_MODE === "database" && !preview) problems.push("Database-only registration is limited to preview deployments");
  if (!["live", "preview"].includes(env.DEPLOYMENT_MODE || "")) problems.push("DEPLOYMENT_MODE must be live or a restricted preview");
  if (preview && !databaseRegistration && (!/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(env.PREVIEW_EMAILS || ""))) problems.push("Preview requires exactly one PREVIEW_EMAILS owner address");
  try {
    const db = new URL(env.DATABASE_URL || "");
    if (!["postgres:", "postgresql:"].includes(db.protocol) || db.searchParams.get("schema") !== "crm") throw new Error();
    if (placeholder(db.hostname) || placeholder(db.password)) throw new Error();
  } catch { problems.push("DATABASE_URL must be PostgreSQL with a private crm schema and real credentials"); }
  try {
    const direct = new URL(env.DIRECT_URL || "");
    if (!["postgres:", "postgresql:"].includes(direct.protocol) || direct.searchParams.get("schema") !== "crm" || placeholder(direct.password)) throw new Error();
  } catch { problems.push("DIRECT_URL must be a migration-capable PostgreSQL connection using schema=crm"); }
  try {
    const url = new URL(env.APP_URL || "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || placeholder(url.hostname) || /localhost|127\.0\.0\.1|example\./i.test(url.hostname)) throw new Error();
  } catch { problems.push("APP_URL must be the final HTTPS origin"); }
  if (placeholder(env.SESSION_SECRET) || (env.SESSION_SECRET?.length || 0) < 32) problems.push("SESSION_SECRET must be a fresh random secret of at least 32 characters");
  if (env.SEED_DEMO_DATA !== "false") problems.push("SEED_DEMO_DATA must be false");
  if (!databaseRegistration) {
    if (env.EMAIL_TRANSPORT !== "smtp" || placeholder(env.SMTP_HOST) || placeholder(env.SMTP_USER) || placeholder(env.SMTP_PASS)) problems.push("Configure real SMTP host and credentials");
    if (placeholder(env.SMTP_FROM) || /localhost/.test(env.SMTP_FROM || "")) problems.push("SMTP_FROM must use the verified sender domain");
    if (!preview && /@resend\.dev\b/i.test(env.SMTP_FROM || "")) problems.push("The Resend test sender is only permitted in an owner-only preview");
    if (!["465", "587", "2587", "2465"].includes(env.SMTP_PORT || "587")) problems.push("SMTP_PORT must be a supported TLS SMTP port");
  }
  if (!env.TRUSTED_IP_HEADER || !/^[a-z0-9-]+$/i.test(env.TRUSTED_IP_HEADER)) problems.push("TRUSTED_IP_HEADER must identify a single-IP header overwritten by the trusted proxy");
  if (env.FILE_STORAGE !== "s3" || placeholder(env.S3_BUCKET) || placeholder(env.S3_REGION || env.AWS_REGION)) problems.push("Configure private S3-compatible file storage");
  if (env.S3_ENDPOINT) {
    try { if (new URL(env.S3_ENDPOINT).protocol !== "https:") throw new Error(); }
    catch { problems.push("S3_ENDPOINT must use HTTPS"); }
    if (placeholder(env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID) || placeholder(env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY)) problems.push("Configure S3-compatible storage credentials on the server");
  }
  if (env.INBOX_ENABLED === "true") {
    if (env.INBOX_STORAGE !== "s3") problems.push("Enabled inbox requires INBOX_STORAGE=s3");
    if (Buffer.from(env.INBOX_ENCRYPTION_KEY || "", "base64").length !== 32) problems.push("Enabled inbox requires a backed-up 32-byte INBOX_ENCRYPTION_KEY");
    if (!/^rediss?:\/\//.test(env.REDIS_URL || "")) problems.push("Enabled inbox requires REDIS_URL and a supervised worker");
  }
  if (env.BILLING_PROVIDER !== "disabled") problems.push("Use BILLING_PROVIDER=disabled until a real payment integration is implemented");
  if (!preview && (placeholder(env.SUPPORT_EMAIL) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL || ""))) problems.push("SUPPORT_EMAIL must be a monitored support address");
  if (!env.OPERATOR_NAME?.trim()) problems.push("OPERATOR_NAME must identify the platform operator");
  return problems;
}
