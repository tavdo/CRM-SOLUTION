import { prisma } from "../db";
import { decrypt } from "./credentials";
import { adapter } from "./registry";
import { ChannelError, type Credentials, type MediaSource } from "./types";
import { fetchMedia, storeMedia, mediaShareUrl } from "./media";

export async function sendQueued(id: string, finalAttempt = false) {
  const message = await prisma.inboxMessage.findUniqueOrThrow({ where: { id }, include: { conversation: { include: { channel: { include: { integration: true } } } }, attachments: true } });
  if (["SENT", "DELIVERED", "READ", "UNCERTAIN", "FAILED"].includes(message.status)) return;
  if (message.status === "SENDING") {
    await prisma.inboxMessage.update({ where: { id }, data: { status: "UNCERTAIN", errorCode: "INTERRUPTED_SEND" } });
    await prisma.inboxConversation.update({ where: { id: message.conversationId }, data: { updatedAt: new Date() } }); return;
  }
  const channel = message.conversation.channel;
  if (channel.status !== "ACTIVE" || channel.integration.status !== "ACTIVE") {
    await prisma.inboxMessage.update({ where: { id }, data: { status: "FAILED", errorCode: "CHANNEL_DISCONNECTED" } });
    await prisma.inboxConversation.update({ where: { id: message.conversationId }, data: { updatedAt: new Date() } }); return;
  }
  const claimed = await prisma.inboxMessage.updateMany({ where: { id, status: "QUEUED" }, data: { status: "SENDING", errorCode: null } });
  if (!claimed.count) return;
  try {
    const attachments = message.attachments.filter(a => a.storageKey && a.status === "READY");
    const payload = JSON.parse(message.payloadJson);
    if (attachments[0]) { payload.url = mediaShareUrl(attachments[0].id, attachments[0].name); payload.size = attachments[0].size; payload.name = attachments[0].name; }
    payload.clientId = message.clientRequestId;
    const externalMessageId = await adapter(channel.type).sendMessage({ accountId: channel.externalAccountId, chatId: message.conversation.externalChatId,
      credentials: decrypt<Credentials>(channel.credentialsEncrypted, channel.companyId), lastIncomingAt: message.conversation.lastIncomingAt,
      subscribed: message.conversation.subscribed }, { text: message.text || "", type: message.type, payload });
    // An echo may already have confirmed this same message while the API call was in flight.
    await prisma.$transaction(async db => {
      const current = await db.inboxMessage.findUniqueOrThrow({ where: { id } });
      const echoed = await db.inboxMessage.findUnique({ where: { channelId_externalMessageId: { channelId: channel.id, externalMessageId } } });
      if (echoed && echoed.id !== id) {
        if (echoed.direction !== "OUT" || echoed.sentByUserId) throw new ChannelError("MESSAGE_ID_CONFLICT", false, true);
        if (message.attachments.length) await db.inboxAttachment.deleteMany({ where: { messageId: echoed.id, companyId: channel.companyId } });
        else await db.inboxAttachment.updateMany({ where: { messageId: echoed.id, companyId: channel.companyId }, data: { messageId: id } });
        await db.inboxMessage.delete({ where: { id: echoed.id } });
      }
      const status = current.status === "READ" || echoed?.status === "READ" ? "READ" : current.status === "DELIVERED" || echoed?.status === "DELIVERED" ? "DELIVERED" : "SENT";
      await db.inboxMessage.update({ where: { id }, data: { externalMessageId, status, errorCode: null, providerTimestamp: current.providerTimestamp || echoed?.providerTimestamp || new Date() } });
      await db.inboxConversation.update({ where: { id: message.conversationId }, data: { lastMessageAt: new Date() } });
    });
  } catch (error) {
    const typed = error instanceof ChannelError ? error : new ChannelError("SEND_RESULT_UNKNOWN", false, true);
    const retry = typed.retryable && !typed.ambiguous && !finalAttempt;
    await prisma.inboxMessage.updateMany({ where: { id, status: "SENDING" }, data: {
      status: typed.ambiguous ? "UNCERTAIN" : retry ? "QUEUED" : "FAILED", errorCode: typed.code,
    } });
    await prisma.inboxConversation.update({ where: { id: message.conversationId }, data: { updatedAt: new Date() } });
    if (retry) throw typed;
  }
}
export async function downloadAttachment(id: string, finalAttempt = false) {
  const attachment = await prisma.inboxAttachment.findUniqueOrThrow({ where: { id }, include: { message: { include: { conversation: { include: { channel: true } } } } } });
  if (attachment.status === "READY" || !attachment.sourceEncrypted) return;
  const channel = attachment.message.conversation.channel;
  try {
    const source = decrypt<MediaSource>(attachment.sourceEncrypted, attachment.companyId);
    const resolved = await adapter(channel.type).resolveMedia(source, decrypt<Credentials>(channel.credentialsEncrypted, channel.companyId));
    const { bytes, mime } = await fetchMedia(resolved.url, resolved.authorization);
    const storageKey = await storeMedia(attachment.companyId, bytes, mime);
    await prisma.inboxAttachment.update({ where: { id }, data: { storageKey, mimeType: mime, size: bytes.length, status: "READY", errorCode: null, sourceEncrypted: null } });
    await prisma.inboxConversation.update({ where: { id: attachment.message.conversationId }, data: { updatedAt: new Date() } });
  } catch (error) {
    const code = error instanceof ChannelError ? error.code : "MEDIA_UNAVAILABLE";
    const retry = !finalAttempt && (!(error instanceof ChannelError) || error.retryable);
    await prisma.inboxAttachment.update({ where: { id }, data: { status: retry ? "PENDING" : "FAILED", errorCode: code } });
    if (retry) throw new ChannelError(code, true);
  }
}
