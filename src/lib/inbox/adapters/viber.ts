import { createHmac } from "node:crypto";
import { equalDigest } from "../credentials";
import { ChannelError, type ChannelAdapter, type ChannelEvent } from "../types";
import { object, str, timestamp } from "./meta-shared";
export async function viberRequest(method: string, token: string, body: unknown = {}) {
  let response: Response;
  try { response = await fetch(`https://chatapi.viber.com/pa/${method}`, { method: "POST", headers: { "X-Viber-Auth-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000), redirect: "error" }); }
  catch { throw new ChannelError("VIBER_TIMEOUT", method !== "send_message", method === "send_message"); }
  // Viber message tokens exceed JavaScript's safe integer range.
  const JSONbig = (await import("json-bigint")).default({ storeAsString: true });
  const data = object(JSONbig.parse(await response.text()));
  if (!response.ok || Number(data.status) !== 0) throw new ChannelError(`VIBER_${str(data.status) || response.status}`, response.status === 429 || response.status >= 500);
  return data;
}
export const viber: ChannelAdapter = {
  type: "VIBER",
  verifyWebhook(raw, signature, secret) { return !!secret && !!signature && equalDigest(signature, createHmac("sha256", secret).update(raw).digest("hex")); },
  parseIncoming(body, accountId = "") {
    const value = object(body); const kind = str(value.event); const token = str(value.message_token);
    if (["delivered", "seen", "failed"].includes(kind) && token) return [{ kind: "status", channelType: "VIBER", accountId, messageIds: [token], status: kind === "seen" ? "READ" : kind === "failed" ? "FAILED" : "DELIVERED" }];
    if (["subscribed", "unsubscribed"].includes(kind)) return [{ kind: "subscription", channelType: "VIBER", accountId, chatId: str(object(value.user).id || value.user_id), subscribed: kind === "subscribed" }];
    if (kind !== "message" || !token) return [];
    const sender = object(value.sender); const message = object(value.message); const type = str(message.type);
    if (!sender.id) return [];
    return [{ kind: "message", accountId, channelType: "VIBER", chatId: str(sender.id), messageId: token, at: timestamp(value.timestamp),
      name: str(sender.name) || undefined, avatar: str(sender.avatar) || undefined, type: type === "picture" ? "IMAGE" : type.toUpperCase(), text: str(message.text) || undefined,
      media: message.media ? [{ url: str(message.media), name: str(message.file_name) || `attachment-${token}`, type: type.toUpperCase() }] : [],
      payload: type === "location" ? { location: object(message.location) } : type === "sticker" ? { stickerId: message.sticker_id } : undefined } satisfies ChannelEvent];
  },
  async sendMessage(ctx, message) {
    if (!ctx.subscribed) throw new ChannelError("VIBER_UNSUBSCRIBED");
    const type = message.type === "IMAGE" ? "picture" : message.type.toLowerCase();
    if (!["text", "picture", "file", "video"].includes(type)) throw new ChannelError("VIBER_TYPE_UNSUPPORTED");
    const response = await viberRequest("send_message", ctx.credentials.accessToken, { receiver: ctx.chatId, type,
      sender: { name: process.env.VIBER_SENDER_NAME || "CRM" }, text: message.text,
      ...(type !== "text" ? { media: message.payload?.url, size: message.payload?.size, file_name: message.payload?.name } : {}) });
    if (!response.message_token) throw new ChannelError("MISSING_MESSAGE_ID", false, true);
    return str(response.message_token);
  },
  async fetchProfile(ctx) { const data = await viberRequest("get_user_details", ctx.credentials.accessToken, { id: ctx.chatId }); return { name: str(object(data.user).name) || undefined, avatar: str(object(data.user).avatar) || undefined }; },
  async checkConnection(accountId, credentials) { const data = await viberRequest("get_account_info", credentials.accessToken); if (str(data.id) !== accountId) throw new ChannelError("VIBER_ACCOUNT_MISMATCH"); },
  async resolveMedia(source) { if (!source.url) throw new ChannelError("MEDIA_UNAVAILABLE"); return { url: source.url }; },
};
