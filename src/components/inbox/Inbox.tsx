"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Search, Send, Settings, Inbox as InboxIcon, ArrowLeft, Paperclip, LockKeyhole } from "lucide-react";
import type { getConversation, inboxBootstrap, listConversations } from "@/lib/services/inbox";
import { inboxApi } from "./api";
import { createRefreshGate } from "./refresh";
import { LoadingIndicator } from "@/components/LoadingIndicator";

type Detail = Awaited<ReturnType<typeof getConversation>>;
type Summary = Awaited<ReturnType<typeof listConversations>>;
type Bootstrap = Awaited<ReturnType<typeof inboxBootstrap>>;
const channelLabels: Record<string, string> = { FACEBOOK: "Messenger", INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp", VIBER: "Viber" };
export function Inbox({ locale, bootstrap, initialConversation = "" }: { locale: string; bootstrap: Bootstrap; initialConversation?: string }) {
  const ka = locale === "ka";
  const label = (en: string, ge: string) => ka ? ge : en;
  const [rows, setRows] = useState<Summary>([]);
  const [selected, setSelected] = useState(initialConversation);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filters, setFilters] = useState({ q: "", channel: "", status: "", assigned: "", unread: "" });
  const filterKey = new URLSearchParams(filters).toString();
  const [listLoad, setListLoad] = useState({ key: filterKey, pending: true });
  const [detailLoad, setDetailLoad] = useState({ id: initialConversation, pending: !!initialConversation });
  const [text, setText] = useState(""); const [note, setNote] = useState(false);
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<"send" | "upload" | null>(null);
  const [available, setAvailable] = useState(bootstrap.available);
  const [attachment, setAttachment] = useState<{ id: string; name: string; type: string } | null>(null);
  const [template, setTemplate] = useState({ name: "", language: "en_US", parameters: "" });
  const [useTemplate, setUseTemplate] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const filterKeyRef = useRef(filterKey); filterKeyRef.current = filterKey;
  const previousFilter = useRef(filterKey);
  const previousSelection = useRef(initialConversation);
  const listRequests = useRef(new Map<string, Promise<Summary>>());
  const detailRequests = useRef(new Map<string, Promise<Detail>>());
  const lastReadMessage = useRef(new Map<string, string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const loadList = useCallback(async () => {
    let pending = listRequests.current.get(filterKey);
    if (!pending) {
      pending = inboxApi<Summary>(`conversations?${filterKey}`).finally(() => { listRequests.current.delete(filterKey); });
      listRequests.current.set(filterKey, pending);
    }
    try {
      const next = await pending;
      if (filterKeyRef.current === filterKey) setRows(next);
    } finally {
      if (filterKeyRef.current === filterKey) setListLoad(current => current.key === filterKey && !current.pending ? current : { key: filterKey, pending: false });
    }
  }, [filterKey]);
  const listLoader = useRef(loadList); listLoader.current = loadList;
  const loadDetail = useCallback(async (id: string) => {
    let pending = detailRequests.current.get(id);
    if (!pending) {
      pending = inboxApi<Detail>(`conversations/${id}`).finally(() => { detailRequests.current.delete(id); });
      detailRequests.current.set(id, pending);
    }
    let next: Detail;
    try { next = await pending; }
    catch (error) {
      if (selectedRef.current !== id) return;
      setDetail(null); setDetailLoad({ id, pending: false });
      throw error;
    }
    if (selectedRef.current !== id) return;
    setDetail(next);
    setDetailLoad(current => current.id === id && !current.pending ? current : { id, pending: false });
    const latestIncoming = [...next.messages].reverse().find(message => message.direction === "IN");
    if (document.visibilityState === "visible" && latestIncoming && lastReadMessage.current.get(id) !== latestIncoming.id) {
      lastReadMessage.current.set(id, latestIncoming.id);
      try {
        await inboxApi(`conversations/${id}`, "POST");
        setRows(current => current.map(row => row.id === id ? { ...row, unreadCount: 0 } : row));
      } catch (error) {
        if (lastReadMessage.current.get(id) === latestIncoming.id) lastReadMessage.current.delete(id);
        throw error;
      }
    }
  }, []);
  useEffect(() => {
    if (previousFilter.current === filterKey) return;
    previousFilter.current = filterKey;
    setListLoad({ key: filterKey, pending: true });
    const timer = setTimeout(() => { void loadList().catch(e => { if (filterKeyRef.current === filterKey) setError(e.message); }); }, 200);
    return () => clearTimeout(timer);
  }, [filterKey, loadList]);
  useEffect(() => {
    if (previousSelection.current === selected) return;
    previousSelection.current = selected;
    setDetailLoad({ id: selected, pending: !!selected });
    setDetail(null); setText(""); setAttachment(null); setError(""); setSuggestions([]); setUseTemplate(false);
    if (selected) void loadDetail(selected).catch(e => { if (selectedRef.current === selected) setError(e.message); });
  }, [selected, loadDetail]);
  useEffect(() => {
    let stopped = false;
    let events: EventSource | null = null;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const refresh = createRefreshGate(async () => {
      if (stopped || document.visibilityState !== "visible") return;
      await Promise.all([listLoader.current(), ...(selectedRef.current ? [loadDetail(selectedRef.current)] : [])]);
    });
    const requestRefresh = () => { void refresh.request().catch(error => { if (!stopped) setError(error.message); }); };
    const disconnect = () => { events?.close(); events = null; clearTimeout(fallback); };
    const connect = () => {
      if (events || stopped || document.visibilityState !== "visible") return;
      events = new EventSource("/api/inbox/events");
      // The first event supplies the initial refresh and resynchronizes after reconnects.
      events.onmessage = () => { clearTimeout(fallback); requestRefresh(); };
      events.onerror = requestRefresh;
      // Data must still load if a proxy or development compilation delays SSE.
      fallback = setTimeout(requestRefresh, 1500);
    };
    const visibility = () => { if (document.visibilityState === "visible") connect(); else disconnect(); };
    document.addEventListener("visibilitychange", visibility);
    connect();
    return () => { stopped = true; disconnect(); refresh.dispose(); document.removeEventListener("visibilitychange", visibility); };
  }, [loadDetail]);
  useEffect(() => {
    if (bootstrap.admin && detail) void inboxApi<typeof suggestions>(`contacts/${detail.conversation.contactId}/suggestions`).then(setSuggestions).catch(() => {});
  }, [detail?.conversation.contactId, bootstrap.admin]); // eslint-disable-line react-hooks/exhaustive-deps
  async function mutate(values: unknown) {
    if (!selected) return;
    try { setError(""); await inboxApi(`conversations/${selected}`, "PATCH", values); await loadDetail(selected); await loadList(); }
    catch (e) { setError((e as Error).message); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!selected || pending) return;
    setPending(true); setPendingAction("send"); setError("");
    try {
      if (note) await inboxApi(`conversations/${selected}`, "PATCH", { note: text });
      else {
        const fingerprint = JSON.stringify({ selected, text, attachment, template, useTemplate });
        if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
        await inboxApi(`conversations/${selected}/messages`, "POST", { text, clientRequestId: request.current.id,
          type: useTemplate ? "TEMPLATE" : attachment?.type || "TEXT", attachmentId: attachment?.id,
          ...(useTemplate ? { template: { name: template.name, language: template.language, parameters: template.parameters ? template.parameters.split("\n") : [] } } : {}) });
      }
      setText(""); setAttachment(null); request.current = null; await loadDetail(selected); await loadList();
    } catch (e) { setError((e as Error).message); } finally { setPending(false); setPendingAction(null); }
  }
  async function upload(file: File) {
    if (!selected) return; setPending(true); setPendingAction("upload"); setError("");
    try {
      const response = await fetch(`/api/inbox/conversations/${selected}/attachments`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) }, body: file });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || "Upload failed"); setAttachment(result);
    } catch (e) { setError((e as Error).message); } finally { setPending(false); setPendingAction(null); }
  }
  async function merge(sourceId: string) {
    if (!detail) return;
    try {
      const targetId = detail.conversation.contactId;
      const preview = await inboxApi<{ source: { firstName: string }; target: { firstName: string } }>("settings", "POST", { action: "merge-preview", sourceId, targetId });
      if (!window.confirm(`${label("Merge contact and all identities/history", "კონტაქტისა და ისტორიის გაერთიანება")}: ${preview.source.firstName} → ${preview.target.firstName}?`)) return;
      await inboxApi("settings", "POST", { action: "merge", sourceId, targetId }); setSuggestions([]); await loadDetail(selected); await loadList();
    } catch (e) { setError((e as Error).message); }
  }
  const conversation = detail?.conversation;
  const listLoading = listLoad.key !== filterKey || listLoad.pending;
  const detailLoading = !!selected && (detailLoad.id !== selected || detailLoad.pending);
  const disconnected = conversation?.channel.status !== "ACTIVE";
  const closedWindow = conversation && conversation.channel.type !== "VIBER" && (!conversation.lastIncomingAt || Date.now() - new Date(conversation.lastIncomingAt).getTime() >= 86400000);
  return <div className="inbox-page">
    <div className="workspace-page-heading"><div><h1 className="page-title">{label("Omnichannel Inbox", "ერთიანი მიმოწერა")}</h1><p>{label("Every conversation, connected to your CRM.", "ყველა საუბარი, დაკავშირებული თქვენს CRM-თან.")}</p></div>
      <div className="workspace-heading-actions">
        <button className="btn btn-secondary" onClick={async () => { try { await inboxApi("settings", "POST", { action: "availability", available: !available }); setAvailable(!available); } catch (e) { setError((e as Error).message); } }}>{available ? "● " : "○ "}{label(available ? "Available" : "Away", available ? "ხელმისაწვდომი" : "გასული")}</button>
        <button className="btn btn-primary" onClick={async () => { try { const result = await inboxApi<{ id: string | null }>("conversations/take", "POST"); if (result.id) { setSelected(result.id); await loadList(); } else setError(label("No unassigned conversations", "მიუნიჭებელი საუბრები არ არის")); } catch (e) { setError((e as Error).message); } }}>{label("Take conversation", "საუბრის აღება")}</button>
        {bootstrap.admin && <Link href={`/${locale}/settings/channels`} className="chrome-pill"><Settings size={15} />{label("Channels", "არხები")}</Link>}
      </div>
    </div>
    {error && <div className="inbox-error" role="alert">{error}</div>}
    {!bootstrap.channels.length && <div className="surface inbox-empty"><InboxIcon size={32} /><h2>{label("Connect your first channel", "დააკავშირეთ პირველი არხი")}</h2><p>{label("Messages appear here after a verified webhook arrives.", "შეტყობინებები გამოჩნდება დადასტურებული ვებჰუკის მიღების შემდეგ.")}</p>{bootstrap.admin && <Link className="btn btn-primary" href={`/${locale}/settings/channels`}>{label("Connect a channel", "არხის დაკავშირება")}</Link>}</div>}
    <div className={`inbox-layout ${selected ? "inbox-selected" : ""}`}>
      <aside className="surface inbox-list-pane">
        <div className="inbox-filters"><label className="inbox-search"><Search size={17} /><input className="input" aria-label={label("Search conversations", "საუბრების ძიება")} placeholder={label("Search contacts or messages", "კონტაქტი ან შეტყობინება")} value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} /></label>
          <div><select className="select" aria-label="Channel" value={filters.channel} onChange={e => setFilters({ ...filters, channel: e.target.value })}><option value="">{label("All channels", "ყველა არხი")}</option>{bootstrap.channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select className="select" aria-label="Status" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">{label("All statuses", "ყველა სტატუსი")}</option>{["OPEN", "PENDING", "CLOSED"].map(s => <option key={s}>{s}</option>)}</select></div>
          {bootstrap.admin && <select className="select" aria-label="Assigned manager" value={filters.assigned} onChange={e => setFilters({ ...filters, assigned: e.target.value })}><option value="">{label("All managers", "ყველა მენეჯერი")}</option><option value="unassigned">{label("Unassigned", "მიუნიჭებელი")}</option>{bootstrap.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}</select>}
          <label className="inbox-check"><input type="checkbox" checked={filters.unread === "true"} onChange={e => setFilters({ ...filters, unread: e.target.checked ? "true" : "" })} />{label("Unread only", "მხოლოდ წაუკითხავი")}</label>
        </div>
        <div className="inbox-conversation-list" aria-busy={listLoading}>{listLoading && <div className="inbox-list-empty"><LoadingIndicator label={label("Loading conversations", "საუბრების ჩატვირთვა")} /></div>}{!listLoading && !rows.length && <p className="muted inbox-list-empty">{label("No conversations match these filters.", "საუბრები ვერ მოიძებნა.")}</p>}{rows.map(row => <button key={row.id} className={`inbox-conversation ${selected === row.id ? "selected" : ""}`} onClick={() => setSelected(row.id)}>
          <span className={`inbox-channel-icon ${row.channel.type.toLowerCase()}`}><MessageCircle size={19} /><small>{row.channel.type.slice(0, 1)}</small></span><span className="inbox-conversation-copy"><strong>{row.contact.firstName} {row.contact.lastName}</strong><span>{row.messages[0]?.text || row.messages[0]?.type || "—"}</span><small>{channelLabels[row.channel.type]} · {row.status}</small></span>{row.unreadCount > 0 && <span className="inbox-unread">{row.unreadCount}</span>}
        </button>)}</div>
      </aside>
      <section className="surface inbox-chat-pane" aria-label={label("Conversation", "საუბარი")} aria-busy={detailLoading}>
        {detailLoading ? <div className="inbox-empty"><LoadingIndicator label={label("Loading conversation", "საუბრის ჩატვირთვა")} /></div> : !selected || !conversation ? <div className="inbox-empty"><MessageCircle size={40} /><h2>{label("Select a conversation", "აირჩიეთ საუბარი")}</h2><p className="muted">{label("Messages and internal notes appear here.", "აქ გამოჩნდება შეტყობინებები და შიდა ჩანაწერები.")}</p></div> : <>
          <div className="inbox-chat-header"><button className="btn btn-secondary inbox-back" onClick={() => setSelected("")} aria-label="Back"><ArrowLeft size={18} /></button><div><Link href={`/${locale}/contacts/${conversation.contactId}`}><strong>{conversation.contact.firstName} {conversation.contact.lastName}</strong></Link><small>{conversation.channel.name} · {channelLabels[conversation.channel.type]}</small></div>
            <select className="select" aria-label="Conversation status" value={conversation.status} onChange={e => void mutate({ status: e.target.value })}>{["OPEN", "PENDING", "CLOSED"].map(s => <option key={s}>{s}</option>)}</select>
            {bootstrap.admin && <select className="select" aria-label="Reassign conversation" value={conversation.assignedUserId || ""} onChange={e => void mutate({ assignedUserId: e.target.value || null })}><option value="">{label("Unassigned", "მიუნიჭებელი")}</option>{bootstrap.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}</select>}
          </div>
          {!!suggestions.length && <div className="inbox-suggestions">{label("Same phone number:", "იგივე ტელეფონი:")} {suggestions.map(s => <button className="btn btn-secondary" key={s.id} onClick={() => void merge(s.id)}>{s.firstName} {s.lastName} · {label("Merge", "გაერთიანება")}</button>)}</div>}
          <div className="inbox-chat-tabs"><button className={!note ? "active" : ""} onClick={() => setNote(false)}>{label("Messages", "შეტყობინებები")}</button><button className={note ? "active" : ""} onClick={() => setNote(true)}><LockKeyhole size={13} />{label("Internal notes", "შიდა ჩანაწერები")}</button></div>
          <div className="inbox-message-list" aria-live="polite">
            {!note && detail.nextCursor && <button className="btn btn-secondary" onClick={async () => { try { const page = await inboxApi<Detail>(`conversations/${selected}?before=${detail.nextCursor}`); setDetail({ ...detail, messages: [...page.messages, ...detail.messages], nextCursor: page.nextCursor }); } catch (e) { setError((e as Error).message); } }}>{label("Load earlier messages", "ძველი შეტყობინებები")}</button>}
            {note ? detail.notes.map(n => <div className="inbox-note" key={n.id}><small>{bootstrap.members.find(m => m.userId === n.userId)?.user.name || "—"} · {new Date(n.createdAt).toLocaleString(locale)}</small><p>{n.text}</p></div>) : detail.messages.map(message => <article className={`inbox-message ${message.direction === "OUT" ? "outgoing" : "incoming"}`} key={message.id}>
              {message.text && <p>{message.text}</p>}{!message.text && !message.attachments.length && !["LOCATION", "TEMPLATE"].includes(message.type) && <p>{message.type}</p>}{message.type === "LOCATION" && <p>{label("Shared location", "გაზიარებული მდებარეობა")}: {JSON.stringify(JSON.parse(message.payloadJson).location || {})}</p>}{message.type === "TEMPLATE" && <small>{label("Template", "შაბლონი")}: {JSON.parse(message.payloadJson).template?.name}</small>}
              {message.attachments.map(a => <div className="inbox-attachment" key={a.id}>{a.status === "READY" ? <>
                {a.mimeType?.startsWith("image/") && !a.mimeType.includes("svg") && <Image unoptimized src={`/api/inbox/attachments/${a.id}`} alt={a.name} width={360} height={240} />}
                {a.mimeType?.startsWith("audio/") && <audio controls src={`/api/inbox/attachments/${a.id}`} />}
                {a.mimeType?.startsWith("video/") && <video controls preload="metadata" src={`/api/inbox/attachments/${a.id}`} />}
                <a href={`/api/inbox/attachments/${a.id}`} target="_blank" rel="noreferrer">{a.name} ↗</a></> : <span>{a.name} · {a.status}{a.errorCode ? ` (${a.errorCode})` : ""}</span>}</div>)}
              <footer><time>{new Date(message.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time>{message.direction === "OUT" && <span>{message.status}</span>}</footer>{message.errorCode && <small role="status" className="inbox-message-error">{message.errorCode}</small>}
            </article>)}
          </div>
          {!note && disconnected && <p className="inbox-window-note">{label("This channel is disconnected. Reconnect it in Channels to reply.", "არხი გათიშულია. პასუხისთვის ხელახლა დააკავშირეთ არხების პარამეტრებში.")}</p>}
          {!note && !disconnected && closedWindow && <p className="inbox-window-note">{label("The 24-hour reply window is closed.", "პასუხის 24-საათიანი ვადა ამოიწურა.")}{conversation.channel.type === "WHATSAPP" && " " + label("Choose an approved template.", "აირჩიეთ დამტკიცებული შაბლონი.")}</p>}
          <form className={`inbox-composer ${note ? "internal" : ""}`} onSubmit={submit}>
            {!note && <div className="inbox-composer-options"><select className="select" aria-label="Quick reply" defaultValue="" onChange={e => { setText(e.target.value); e.currentTarget.value = ""; }}><option value="">{label("Quick replies", "სწრაფი პასუხები")}</option>{bootstrap.quickReplies.map(r => <option key={r.id} value={r.text}>{r.title}</option>)}</select>
              {conversation.channel.type === "WHATSAPP" && <label className="inbox-check"><input type="checkbox" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} />{label("Template", "შაბლონი")}</label>}
              <input hidden type="file" ref={fileInput} onChange={e => { if (e.target.files?.[0]) void upload(e.target.files[0]); e.target.value = ""; }} /><button className="btn btn-secondary" type="button" onClick={() => fileInput.current?.click()} disabled={pending || !!closedWindow || disconnected} aria-busy={pending && pendingAction === "upload"} aria-label={label("Attach file", "ფაილის მიმაგრება")}>{pending && pendingAction === "upload" ? <LoadingIndicator compact label={label("Uploading file", "ფაილის ატვირთვა")} /> : <Paperclip size={16} />}</button>
            </div>}
            {useTemplate && !note && <div className="inbox-template"><input required className="input" placeholder="Approved template name" value={template.name} onChange={e => setTemplate({ ...template, name: e.target.value })} /><input required className="input" aria-label="Template language code" value={template.language} onChange={e => setTemplate({ ...template, language: e.target.value })} /><textarea className="textarea" placeholder="Body parameters, one per line" value={template.parameters} onChange={e => setTemplate({ ...template, parameters: e.target.value })} /></div>}
            {attachment && !note && <span>{attachment.name} <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">×</button></span>}
            <div className="inbox-send-row"><textarea className="textarea" aria-label={note ? label("Internal note", "შიდა ჩანაწერი") : label("Reply", "პასუხი")} placeholder={note ? label("Only your team can see this note", "ჩანაწერი ხილულია მხოლოდ გუნდისთვის") : label("Write a reply…", "დაწერეთ პასუხი…")} value={text} onChange={e => setText(e.target.value)} maxLength={note ? 5000 : 4000} disabled={!note && (disconnected || (!!closedWindow && !useTemplate))} /><button className="btn btn-primary" disabled={pending || (!note && (disconnected || (!!closedWindow && !useTemplate)))} aria-busy={pending && pendingAction === "send"}>{pending && pendingAction === "send" ? <LoadingIndicator compact label={note ? label("Saving note", "ჩანაწერის შენახვა") : label("Sending message", "შეტყობინების გაგზავნა")} /> : <Send size={16} />}{label(note ? "Add note" : "Send", note ? "ჩანაწერი" : "გაგზავნა")}</button></div>
          </form>
        </>}
      </section>
    </div>
    <p className="overview-scope-note">{label("Messages stay connected to the contact's history across channels.", "შეტყობინებები ინახება კონტაქტის ისტორიაში ყველა არხიდან.")}</p>
  </div>;
}
