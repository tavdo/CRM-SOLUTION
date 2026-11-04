"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Link2, ShieldCheck } from "lucide-react";
import type { inboxBootstrap } from "@/lib/services/inbox";
import { inboxApi } from "./api";
type Bootstrap = Awaited<ReturnType<typeof inboxBootstrap>>;
export function ChannelSettings({ locale, bootstrap, appUrl, integrations, failedEvents, pendingCount, keyConfigured }: {
  locale: string; bootstrap: Bootstrap; appUrl: string; integrations: { id: string; name: string; provider: string }[];
  failedEvents: { id: string; attempts: number; createdAt: Date }[]; pendingCount: number; keyConfigured: boolean;
}) {
  const router = useRouter(); const ka = locale === "ka"; const l = (en: string, ge: string) => ka ? ge : en;
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [pending, setPending] = useState(false);
  const [type, setType] = useState("FACEBOOK"); const [integrationId, setIntegrationId] = useState("");
  const [verifyTokens, setVerifyTokens] = useState<Record<string, string>>({});
  async function action(body: unknown) {
    setPending(true); setError(""); setNotice("");
    try { const result = await inboxApi<{ ok?: boolean; code?: string; integrationId?: string }>("settings", "POST", body);
      if (result.ok === false) setError(result.code || "Connection failed"); else setNotice(l("Saved", "შენახულია")); router.refresh(); return true;
    } catch (e) { setError((e as Error).message); return false; } finally { setPending(false); }
  }
  return <div className="construction-stack">
    <div className="workspace-page-heading"><div><h1 className="page-title">{l("Inbox channels", "მიმოწერის არხები")}</h1><p>{l("Connect accounts and manage your team's replies.", "დააკავშირეთ ანგარიშები და მართეთ გუნდის პასუხები.")}</p></div><Link className="btn btn-secondary" href={`/${locale}/inbox`}>{l("Open inbox", "მიმოწერის გახსნა")}</Link></div>
    {error && <div className="inbox-error" role="alert">{error}</div>}{notice && <div className="surface inbox-notice" role="status">{notice}</div>}
    {!keyConfigured && <div className="inbox-error">{l("Configure INBOX_ENCRYPTION_KEY before connecting accounts. See the inbox setup guide.", "ანგარიშების დაკავშირებამდე დააყენეთ INBOX_ENCRYPTION_KEY. იხილეთ დაყენების გზამკვლევი.")}</div>}
    <section className="surface construction-panel"><h2 className="section-title"><Link2 size={18} /> {l("Connect an account", "ანგარიშის დაკავშირება")}</h2>
      <form className="inbox-settings-form" onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); if (await action({ ...data, action: "connect", type, integrationId: integrationId || undefined })) form.reset(); }}>
        <label>{l("Channel", "არხი")}<select className="select" value={type} onChange={e => { setType(e.target.value); setIntegrationId(""); }}><option value="FACEBOOK">Facebook Messenger</option><option value="INSTAGRAM">Instagram Direct</option><option value="WHATSAPP">WhatsApp Cloud</option><option value="VIBER">Viber Bot</option></select></label>
        <label>{l("Account name", "ანგარიშის სახელი")}<input className="input" name="name" required maxLength={100} /></label>
        <label>{l("Page / Instagram / phone number / bot ID", "გვერდის / Instagram-ის / ნომრის / ბოტის ID")}<input className="input" name="externalAccountId" required maxLength={150} /></label>
        <label>{l("Access token", "წვდომის ტოკენი")}<input className="input" name="accessToken" type="password" autoComplete="off" required minLength={10} /></label>
        {type !== "VIBER" && <label>{l("Meta app", "Meta აპლიკაცია")}<select className="select" value={integrationId} onChange={e => setIntegrationId(e.target.value)}><option value="">{l("New app connection", "ახალი აპლიკაცია")}</option>{integrations.filter(i => i.provider === "META").map(i => <option value={i.id} key={i.id}>{i.name} · {i.id}</option>)}</select></label>}
        {!integrationId && type !== "VIBER" && <label>{l("Meta app secret", "Meta აპლიკაციის საიდუმლო")}<input className="input" name="appSecret" type="password" autoComplete="off" required /></label>}
        {!integrationId && <label>{l("Webhook verify token (save a copy)", "ვებჰუკის დამადასტურებელი ტოკენი (შეინახეთ ასლი)")}<input className="input" name="verifyToken" type="password" autoComplete="off" required minLength={16} /><small className="muted">{l("Choose at least 16 characters. Meta asks for this value when registering the webhook.", "აირჩიეთ მინიმუმ 16 სიმბოლო. Meta მოითხოვს ამ მნიშვნელობას ვებჰუკის რეგისტრაციისას.")}</small></label>}
        <button className="btn btn-primary" disabled={pending || !keyConfigured}><ShieldCheck size={16} />{l("Save encrypted connection", "დაშიფრული კავშირის შენახვა")}</button>
      </form>
    </section>
    {bootstrap.channels.map(channel => <section className="surface construction-panel" key={channel.id}>
      <div className="construction-heading"><h2 className="section-title">{channel.name} <small className="muted">{channel.type}</small></h2><span className="badge">{channel.status === "DISCONNECTED" ? l("Disconnected", "გათიშული") : channel.lastError ? channel.lastError : channel.lastCheckedAt ? l("Token verified", "ტოკენი შემოწმებულია") : l("Awaiting verification", "ელოდება შემოწმებას")}</span></div>
      <p className="muted">{l("Account", "ანგარიში")}: {channel.externalAccountId}</p>
      <label className="inbox-webhook-label">Webhook URL<input className="input" readOnly value={`${appUrl}/api/inbox/webhooks/${channel.type === "VIBER" ? "viber" : "meta"}/${channel.integrationId}`} onFocus={e => e.target.select()} /></label>
      {channel.type !== "VIBER" && <div className="construction-row"><button className="btn btn-secondary" onClick={async () => { try { const result = await inboxApi<{ verifyToken: string }>("settings", "POST", { action: "verify-token", id: channel.id }); setVerifyTokens({ ...verifyTokens, [channel.id]: result.verifyToken }); } catch (e) { setError((e as Error).message); } }}>{l("Show verify token", "დამადასტურებელი ტოკენის ჩვენება")}</button>{verifyTokens[channel.id] !== undefined && <input className="input" readOnly aria-label="Webhook verify token" value={verifyTokens[channel.id]} onFocus={e => e.target.select()} />}</div>}
      <p className="muted">{l("Meta channels using the same app share its webhook URL and original verify token. Tokens are never returned by the settings API.", "ერთი Meta აპლიკაციის არხები იყენებს საერთო ვებჰუკს და თავდაპირველ დამადასტურებელ ტოკენს. წვდომის ტოკენები არ ბრუნდება პარამეტრების API-დან.")}</p>
      <div className="construction-row"><button disabled={pending} className="btn btn-secondary" onClick={() => void action({ action: "check", id: channel.id })}>{l("Check connection", "კავშირის შემოწმება")}</button><button disabled={pending || channel.status === "DISCONNECTED"} className="btn btn-secondary" onClick={() => void action({ action: "disconnect", id: channel.id })}>{l("Disconnect", "გათიშვა")}</button></div>
      <details className="construction-disclosure"><summary><Settings size={14} /> {l("Welcome and working hours", "მისალმება და სამუშაო საათები")}</summary><AutomationForm settings={JSON.parse(channel.settingsJson)} onSave={values => action({ ...values, action: "automation", id: channel.id })} disabled={pending} ka={ka} /></details>
    </section>)}
    <section className="surface construction-panel"><h2 className="section-title">{l("Quick replies", "სწრაფი პასუხები")}</h2><ul>{bootstrap.quickReplies.map(r => <li key={r.id}><strong>{r.title}</strong> — {r.text}</li>)}</ul><form className="inbox-settings-form" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await action({ action: "quick-reply", ...Object.fromEntries(new FormData(form)) })) form.reset(); }}><input className="input" name="title" required placeholder={l("Reply title", "პასუხის სათაური")} /><textarea className="textarea" name="text" required placeholder={l("Reply text", "პასუხის ტექსტი")} /><button className="btn btn-primary" disabled={pending}>{l("Add quick reply", "პასუხის დამატება")}</button></form></section>
    <section className="surface construction-panel"><h2 className="section-title">{l("Processing", "დამუშავება")}</h2><p>{l("Pending dispatch", "გაგზავნის მოლოდინში")}: {pendingCount}</p><p className="muted">{l("If this count keeps growing, check the inbox worker and Redis. Failed events can be replayed without duplicating messages.", "თუ რიგი იზრდება, შეამოწმეთ Inbox worker და Redis. წარუმატებელი მოვლენების გამეორება არ აორმაგებს შეტყობინებებს.")}</p>{failedEvents.map(e => <div className="construction-row" key={e.id}><code>{e.id}</code><span>{e.attempts} attempts</span><button className="btn btn-secondary" disabled={pending} onClick={() => void action({ action: "retry-webhook", id: e.id })}>{l("Retry", "გამეორება")}</button></div>)}</section>
  </div>;
}
function AutomationForm({ settings, onSave, disabled, ka }: { settings: Record<string, unknown>; onSave: (values: Record<string, unknown>) => Promise<boolean>; disabled: boolean; ka: boolean }) {
  const l = (en: string, ge: string) => ka ? ge : en;
  return <form className="inbox-settings-form" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void onSave({ welcome: String(data.get("welcome")), away: String(data.get("away")), timezone: String(data.get("timezone")), startHour: Number(data.get("startHour")), endHour: Number(data.get("endHour")), workDays: data.getAll("workDays").map(Number) }); }}>
    <label>{l("Welcome message (blank disables)", "მისალმება (ცარიელი — გამორთული)")}<textarea className="textarea" name="welcome" defaultValue={String(settings.welcome || "")} maxLength={2000} /></label>
    <label>{l("Outside working hours reply", "პასუხი არასამუშაო დროს")}<textarea className="textarea" name="away" defaultValue={String(settings.away || "")} maxLength={2000} /></label>
    <label>{l("Timezone", "საათობრივი სარტყელი")}<input className="input" name="timezone" defaultValue={String(settings.timezone || "Asia/Tbilisi")} required /></label>
    <label>{l("Opening hour", "გახსნის საათი")}<input className="input" type="number" name="startHour" min={0} max={23} defaultValue={Number(settings.startHour ?? 9)} required /></label><label>{l("Closing hour", "დახურვის საათი")}<input className="input" type="number" name="endHour" min={1} max={24} defaultValue={Number(settings.endHour ?? 18)} required /></label>
    <div>{(ka ? ["კვ", "ორ", "სა", "ოთ", "ხუ", "პა", "შა"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day, i) => <label className="inbox-check" key={day}><input name="workDays" type="checkbox" value={i} defaultChecked={((settings.workDays as number[]) || [1, 2, 3, 4, 5]).includes(i)} />{day}</label>)}</div>
    <button className="btn btn-primary" disabled={disabled}>{l("Save automation", "ავტომატიზაციის შენახვა")}</button>
  </form>;
}
