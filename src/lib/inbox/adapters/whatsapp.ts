import { ChannelError, type ChannelAdapter, type ChannelEvent } from "../types";
import { verifyMeta, graph, array, object, str, timestamp, assertWindow, metaMedia, checkMeta } from "./meta-shared";
export const whatsapp: ChannelAdapter = {
  type: "WHATSAPP", verifyWebhook: verifyMeta,
  parseIncoming(body) {
    const root = object(body); if (root.object !== "whatsapp_business_account") return [];
    const result: ChannelEvent[] = [];
    for (const entry of array(root.entry)) for (const change of array(object(entry).changes)) {
      const value = object(object(change).value); const accountId = str(object(value.metadata).phone_number_id); if (!accountId) continue;
      for (const messageValue of array(value.messages)) {
        const message = object(messageValue); const chatId = str(message.from); if (!message.id || !chatId) continue;
        const type = str(message.type); const media = object(message[type]);
        const contact = array(value.contacts).map(object).find(c => str(c.wa_id) === chatId);
        const text = type === "text" ? str(object(message.text).body) : str(media.caption);
        const location = type === "location" ? { latitude: media.latitude, longitude: media.longitude, name: media.name } : undefined;
        result.push({ kind: "message", channelType: "WHATSAPP", accountId, chatId, phone: `+${chatId}`, name: str(object(contact?.profile).name) || undefined,
          messageId: str(message.id), at: timestamp(Number(message.timestamp) * 1000), text: text || undefined,
          type: type === "document" ? "FILE" : type.toUpperCase(), media: media.id ? [{ mediaId: str(media.id), name: str(media.filename) || `attachment-${message.id}`, type: type.toUpperCase() }] : [],
          payload: location ? { location } : undefined });
      }
      for (const statusValue of array(value.statuses)) {
        const status = object(statusValue); const normalized = str(status.status).toUpperCase();
        if (!["SENT", "DELIVERED", "READ", "FAILED"].includes(normalized) || !status.id) continue;
        result.push({ kind: "status", channelType: "WHATSAPP", accountId, chatId: str(status.recipient_id), messageIds: [str(status.id)], status: normalized as "SENT" | "DELIVERED" | "READ" | "FAILED" });
      }
    }
    return result;
  },
  async sendMessage(ctx, message) {
    let content: Record<string, unknown>;
    if (message.type === "TEMPLATE") {
      const template = object(message.payload?.template);
      content = { type: "template", template: { name: template.name, language: { code: template.language },
        ...(array(template.parameters).length ? { components: [{ type: "body", parameters: array(template.parameters).map(text => ({ type: "text", text: str(text) })) }] } : {}) } };
    } else {
      assertWindow(ctx);
      if (message.type === "TEXT") content = { type: "text", text: { body: message.text } };
      else {
        const type = message.type === "FILE" ? "document" : message.type.toLowerCase();
        if (!["image", "document", "audio", "video"].includes(type)) throw new ChannelError("WHATSAPP_TYPE_UNSUPPORTED");
        content = { type, [type]: { link: message.payload?.url, ...(message.text && ["image", "video", "document"].includes(type) ? { caption: message.text } : {}) } };
      }
    }
    const response = await graph(`${encodeURIComponent(ctx.accountId)}/messages`, ctx.credentials.accessToken,
      { messaging_product: "whatsapp", recipient_type: "individual", to: ctx.chatId, ...content });
    const id = str(object(array(response.messages)[0]).id);
    if (!id) throw new ChannelError("MISSING_MESSAGE_ID", false, true);
    return id;
  },
  async fetchProfile() { return {}; }, // WhatsApp supplies permitted profile data in its message webhook.
  checkConnection: checkMeta, resolveMedia: metaMedia,
};
