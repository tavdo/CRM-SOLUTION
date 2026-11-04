import { ChannelError, type ChannelAdapter } from "../types";
import { verifyMeta, parseMeta, checkMeta, metaMedia, graph, str, assertWindow } from "./meta-shared";
export const instagram: ChannelAdapter = {
  type: "INSTAGRAM", verifyWebhook: verifyMeta, parseIncoming: body => parseMeta(body, "INSTAGRAM"),
  async sendMessage(ctx, message) {
    if (!["TEXT", "IMAGE", "VIDEO", "AUDIO"].includes(message.type)) throw new ChannelError("INSTAGRAM_TYPE_UNSUPPORTED");
    assertWindow(ctx);
    const response = await graph(`${encodeURIComponent(ctx.accountId)}/messages`, ctx.credentials.accessToken, {
      recipient: { id: ctx.chatId }, message: message.type === "TEXT" ? { text: message.text } : {
        attachment: { type: message.type.toLowerCase(), payload: { url: message.payload?.url } },
      },
    });
    if (!response.message_id) throw new ChannelError("MISSING_MESSAGE_ID", false, true);
    return str(response.message_id);
  },
  async fetchProfile(ctx) {
    const data = await graph(`${encodeURIComponent(ctx.chatId)}?fields=name,username,profile_pic`, ctx.credentials.accessToken);
    return { name: str(data.name || data.username) || undefined, avatar: str(data.profile_pic) || undefined };
  },
  checkConnection: checkMeta, resolveMedia: metaMedia,
};
