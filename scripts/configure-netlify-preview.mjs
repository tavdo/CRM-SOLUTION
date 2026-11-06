import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";

// Uses the user's already-authorized official CLI session. Secrets never appear
// in arguments, logs, tracked files, or browser-accessible configuration.
const settings = parseEnv(readFileSync(".env.preview.local", "utf8"));
const allowed = new Set(["DATABASE_URL", "DIRECT_URL", "DEPLOYMENT_MODE", "APP_URL", "SESSION_SECRET",
  "SEED_DEMO_DATA", "EMAIL_TRANSPORT", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
  "FILE_STORAGE", "INBOX_STORAGE", "S3_BUCKET", "S3_REGION", "S3_ENDPOINT", "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY", "OPERATOR_NAME", "SUPPORT_EMAIL", "PREVIEW_EMAILS", "TRUSTED_IP_HEADER",
  "INBOX_ENABLED", "BILLING_PROVIDER"]);
if (Object.keys(settings).some(key => !allowed.has(key)) || [...allowed].some(key => !(key in settings))) {
  throw new Error("Preview settings must contain only the approved runtime allowlist");
}
if (settings.DEPLOYMENT_MODE !== "preview" || !/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(settings.PREVIEW_EMAILS)) {
  throw new Error("Only a single-owner preview can be configured by this command");
}
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const db = new URL(settings[key]);
  if (!/^postgres(ql)?:$/.test(db.protocol) || !/^crm_app(?:\.|$)/.test(decodeURIComponent(db.username)) || db.searchParams.get("schema") !== "crm") {
    throw new Error("Only restricted crm_app database connections may be uploaded");
  }
}
const state = JSON.parse(readFileSync(".netlify/state.json", "utf8"));
const configRoot = process.env.APPDATA || process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
const configPath = process.platform === "win32" ? path.join(configRoot, "netlify/Config/config.json") : path.join(configRoot, "netlify/config.json");
const cli = JSON.parse(readFileSync(configPath, "utf8"));
const token = cli.users?.[cli.userId]?.auth?.token;
if (!token || !state.siteId) throw new Error("Authorize and link the official Netlify CLI first");
async function api(route, method = "GET", body) {
  const response = await fetch(`https://api.netlify.com/api/v1${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Netlify configuration request failed (HTTP ${response.status}); no secret values were logged`);
  return response.json();
}
const site = await api(`/sites/${encodeURIComponent(state.siteId)}`);
if (new URL(settings.APP_URL).hostname !== `${site.name}.netlify.app`) throw new Error("Linked site does not match the approved preview origin");
const route = `/accounts/${encodeURIComponent(site.account_slug)}/env?site_id=${encodeURIComponent(site.id)}`;
const existing = await api(route);
const values = Object.entries(settings).map(([key, value]) => ({ key, values: [{ context: "all", value }] }));
const fresh = values.filter(item => !existing.some(old => old.key === item.key));
// Omit granular scopes: selecting them is a paid feature on the Free plan.
if (fresh.length) await api(route, "POST", fresh);
for (const item of values) {
  const old = existing.find(entry => entry.key === item.key);
  if (old && !old.values.some(value => value.context === "all" && value.value === settings[item.key])) {
    await api(`/accounts/${encodeURIComponent(site.account_slug)}/env/${encodeURIComponent(item.key)}?site_id=${encodeURIComponent(site.id)}`, "PUT", item);
  }
}
const stored = await api(route);
if (values.some(item => !stored.some(entry => entry.key === item.key && entry.values.some(value => value.context === "all" && value.value === settings[item.key])))) {
  throw new Error("Stored Netlify settings did not match the approved preview configuration");
}
console.log(`Verified ${values.length} approved runtime settings on ${site.name}; no administrator or backup credentials uploaded. Redeploy for changes to take effect.`);
