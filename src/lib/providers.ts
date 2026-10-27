/** Provider state describes verified behavior; saved identifiers never imply delivery. */
export type ProviderState = "unavailable" | "not_configured" | "demo" | "connected" | "error";
export type ProviderInfo = {
  id: "sms" | "rsge" | "bank" | "billing" | "email" | "webform";
  state: ProviderState;
  detail: "smsUnavailable" | "rsReference" | "rsUnconfigured" | "bankSaved" | "bankMissing" | "billingDemo" | "billingUnconfigured" | "billingUnavailable" | "emailSmtp" | "emailDemo" | "webform";
};
export const SUPPORTED_AUTOMATION_ACTIONS = ["CREATE_TASK", "POST_FEED"] as const;
export type SupportedAutomationAction = (typeof SUPPORTED_AUTOMATION_ACTIONS)[number];
export function isSupportedAutomationAction(actionType: string): actionType is SupportedAutomationAction {
  return (SUPPORTED_AUTOMATION_ACTIONS as readonly string[]).includes(actionType);
}
export function smsProvider(): ProviderInfo {
  return { id: "sms", state: "unavailable", detail: "smsUnavailable" };
}
export function rsGeProvider(hasInternalRef: boolean): ProviderInfo {
  return { id: "rsge", state: "not_configured", detail: hasInternalRef ? "rsReference" : "rsUnconfigured" };
}
export function bankAccountProvider(iban: string | null | undefined): ProviderInfo {
  return { id: "bank", state: "not_configured", detail: iban?.trim() ? "bankSaved" : "bankMissing" };
}
export function billingProvider(): ProviderInfo {
  const provider = process.env.BILLING_PROVIDER ?? "dev";
  return { id: "billing", state: provider === "dev" ? "demo" : provider === "stripe" ? "not_configured" : "unavailable",
    detail: provider === "dev" ? "billingDemo" : provider === "stripe" ? "billingUnconfigured" : "billingUnavailable" };
}
export function emailProvider(): ProviderInfo {
  const smtp = process.env.EMAIL_TRANSPORT !== "console" && process.env.EMAIL_TRANSPORT && process.env.SMTP_HOST;
  return { id: "email", state: smtp ? "not_configured" : "demo", detail: smtp ? "emailSmtp" : "emailDemo" };
}
export function webFormProvider(): ProviderInfo {
  return { id: "webform", state: "connected", detail: "webform" };
}
export function providerTone(state: ProviderState): "ok" | "warn" | "danger" | "default" {
  return state === "connected" ? "ok" : state === "error" ? "danger" : state === "demo" || state === "unavailable" ? "warn" : "default";
}
