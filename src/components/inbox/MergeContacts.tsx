"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inboxApi } from "./api";
type Match = { id: string; firstName: string; lastName: string; phone: string | null };
type Preview = { source: Match & { _count: { inboxIdentities: number; inboxConversations: number; deals: number } }; target: Match };
export function MergeContacts({ contactId, locale }: { contactId: string; locale: string }) {
  const router = useRouter(); const ka = locale === "ka"; const l = (en: string, ge: string) => ka ? ge : en;
  const [query, setQuery] = useState(""); const [matches, setMatches] = useState<Match[]>([]); const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null); const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { void inboxApi<Match[]>(`contacts?${new URLSearchParams({ q: query, exclude: contactId })}`).then(rows => { if (active) setMatches(rows); }).catch(e => { if (active) setError(e.message); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, contactId]);
  return <details className="construction-disclosure"><summary>{l("Merge duplicate contact", "დუბლირებული კონტაქტის გაერთიანება")}</summary>
    <p className="muted">{l("Choose the contact to keep. This contact's linked identities and history will move to it.", "აირჩიეთ შესანარჩუნებელი კონტაქტი. ამ კონტაქტის იდენტობები და ისტორია მას გადაეცემა.")}</p>
    <input className="input" aria-label={l("Find contact to keep", "შესანარჩუნებელი კონტაქტის ძიება")} placeholder={l("Search name, phone or email", "სახელი, ტელეფონი ან ელფოსტა")} value={query} onChange={e => { setQuery(e.target.value); setPreview(null); }} />
    <div className="construction-stack">{matches.map(match => <button key={match.id} className="btn btn-secondary" onClick={async () => { try { setPreview(await inboxApi<Preview>("settings", "POST", { action: "merge-preview", sourceId: contactId, targetId: match.id })); } catch (e) { setError((e as Error).message); } }}>{match.firstName} {match.lastName} · {match.phone || "—"}</button>)}</div>
    {preview && <div className="construction-disclosure"><p><strong>{preview.source.firstName} {preview.source.lastName}</strong> → <strong>{preview.target.firstName} {preview.target.lastName}</strong></p><p>{preview.source._count.inboxConversations} {l("conversations", "საუბარი")} · {preview.source._count.inboxIdentities} {l("identities", "იდენტობა")} · {preview.source._count.deals} {l("deals", "გარიგება")}</p><p className="muted">{l("The source contact is archived. Message history is preserved.", "საწყისი კონტაქტი დაარქივდება. შეტყობინებების ისტორია შენარჩუნდება.")}</p><button className="btn btn-primary" disabled={pending} onClick={async () => { setPending(true); try { await inboxApi("settings", "POST", { action: "merge", sourceId: contactId, targetId: preview.target.id }); router.replace(`/${locale}/contacts/${preview.target.id}`); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setPending(false); } }}>{l("Confirm merge", "გაერთიანების დადასტურება")}</button></div>}
    {error && <p className="inbox-error" role="alert">{error}</p>}
  </details>;
}
