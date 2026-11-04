import { createHmac } from "node:crypto";
import { equalDigest } from "../credentials";
import { ChannelError, type ChannelEvent, type Credentials, type SendContext, type OutgoingMessage, type MediaSource } from "../types";

export const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const str = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
export function timestamp(value: unknown) {
  const milliseconds = Number(value);
  const result = new Date(milliseconds);
  if (!Number.isFinite(milliseconds) || !Number.isFinite(result.getTime())) throw new ChannelError("INVALID_TIMESTAMP");
  return result;
}
export function verifyMeta(raw: string, signature: string | null, secret: string) {
  return !!secret && !!signature && equalDigest(signature, `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
}
export async function graph(path: string, token: string, body?: unknown): Promise<Record<string, unknown>> {
  const version = process.env.META_GRAPH_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version)) throw new ChannelError("META_VERSION_MISSING");
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
      method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000), redirect: "error",
    });
  } catch { throw new ChannelError("PROVIDER_TIMEOUT", !body, !!body); }
  const data = object(await response.json().catch(() => ({})));
  if (!response.ok || data.error) {
    const error = object(data.error);
    throw new ChannelError(`META_${str(error.code) || response.status}`, response.status === 429 || error.is_transient === true || response.status >= 500);
  }
  return data;
}
export function parseMeta(body: unknown, type: "FACEBOOK" | "INSTAGRAM"): ChannelEvent[] {
  const root = object(body);
  if (root.object !== (type === "FACEBOOK" ? "page" : "instagram")) return [];
  const events: ChannelEvent[] = [];
  for (const entryValue of array(root.entry)) {
    const entry = object(entryValue); const accountId = str(entry.id);
    for (const eventValue of array(entry.messaging)) {
      const event = object(eventValue); const message = object(event.message);
      const echo = message.is_echo === true;
      const chatId = str(object(echo ? event.recipient : event.sender).id);
      if (!accountId || !chatId) continue;
      const delivery = object(event.delivery); const read = object(event.read);
      if (event.delivery || event.read) {
        events.push({ kind: "status", accountId, channelType: type, chatId,
          messageIds: [...array(delivery.mids).map(str), ...(read.mid ? [str(read.mid)] : [])], watermark: delivery.watermark || read.watermark ? timestamp(delivery.watermark || read.watermark) : undefined,
          status: event.read ? "READ" : "DELIVERED" });
        continue;
      }
      if (!message.mid) continue;
      const media: MediaSource[] = [];
      let messageType = "TEXT";
      let location: Record<string, unknown> | undefined;
      for (const item of array(message.attachments)) {
        const attachment = object(item); const payload = object(attachment.payload);
        messageType = str(attachment.type).toUpperCase() || "FILE";
        if (messageType === "LOCATION") location = object(payload.coordinates);
        else if (payload.url) media.push({ url: str(payload.url), name: `attachment-${media.length + 1}`, type: messageType });
      }
      events.push({ kind: "message", accountId, channelType: type, chatId, messageId: str(message.mid),
        at: timestamp(event.timestamp), echo, text: str(message.text) || undefined, type: messageType, media,
        payload: { ...(location ? { location } : {}), ...(echo && message.metadata ? { clientId: str(message.metadata) } : {}) } });
    }
  }
  return events;
}
export async function sendMeta(ctx: SendContext, message: OutgoingMessage) {
  assertWindow(ctx);
  const response = await graph(`${encodeURIComponent(ctx.accountId)}/messages`, ctx.credentials.accessToken, {
    recipient: { id: ctx.chatId }, messaging_type: "RESPONSE", message: { ...(message.type === "TEXT" ? { text: message.text } : {
      attachment: { type: message.type.toLowerCase(), payload: { url: message.payload?.url, is_reusable: false } },
    }), ...(message.payload?.clientId ? { metadata: message.payload.clientId } : {}) },
  });
  if (!response.message_id) throw new ChannelError("MISSING_MESSAGE_ID", false, true);
  return str(response.message_id);
}
export function assertWindow(ctx: SendContext) {
  if (!ctx.lastIncomingAt || Date.now() - ctx.lastIncomingAt.getTime() >= 86400000) throw new ChannelError("SERVICE_WINDOW_CLOSED");
}
export async function metaProfile(ctx: SendContext) {
  const data = await graph(`${encodeURIComponent(ctx.chatId)}?fields=name,profile_pic`, ctx.credentials.accessToken);
  return { name: str(data.name) || undefined, avatar: str(data.profile_pic) || undefined };
}
export async function checkMeta(accountId: string, credentials: Credentials) { await graph(`${encodeURIComponent(accountId)}?fields=id`, credentials.accessToken); }
export async function metaMedia(source: MediaSource, credentials: Credentials) {
  if (source.mediaId) {
    const data = await graph(encodeURIComponent(source.mediaId), credentials.accessToken);
    if (!data.url) throw new ChannelError("MEDIA_UNAVAILABLE");
    return { url: str(data.url), authorization: `Bearer ${credentials.accessToken}` };
  }
  if (!source.url) throw new ChannelError("MEDIA_UNAVAILABLE");
  return { url: source.url };
}
