import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { decrypt, encrypt } from "./credentials";
import { adapter } from "./registry";
import { resolveContact, resolveLead } from "./matching";
import { nextAgent } from "./assignment";
import type { ChannelEvent, IncomingEvent, Credentials } from "./types";
import { ChannelError } from "./types";
import { scheduleAutoReply } from "./auto-replies";

export async function processEvent(integrationId: string, event: ChannelEvent) {
  const channel = await prisma.inboxChannel.findFirst({ where: { integrationId, type: event.channelType, externalAccountId: event.accountId, status: "ACTIVE", integration: { status: "ACTIVE" } } });
  if (!channel) return; // A Meta app can deliver events for accounts not connected here.
  if (event.kind === "subscription") {
    await prisma.inboxConversation.updateMany({ where: { companyId: channel.companyId, channelId: channel.id, externalChatId: event.chatId }, data: { subscribed: event.subscribed } }); return;
  }
  if (event.kind === "status") {
    const messages = await prisma.inboxMessage.findMany({ where: { companyId: channel.companyId, channelId: channel.id, direction: "OUT",
      ...(event.messageIds.length ? { externalMessageId: { in: event.messageIds } } : event.watermark && event.chatId ? {
        conversation: { externalChatId: event.chatId }, providerTimestamp: { lte: event.watermark }, externalMessageId: { not: null },
      } : { id: "__none__" }) } });
    const ranks: Record<string, number> = { QUEUED: 0, SENDING: 0, UNCERTAIN: 0, FAILED: 0, SENT: 1, DELIVERED: 2, READ: 3 };
    for (const message of messages) {
      if (event.status === "FAILED" && ["DELIVERED", "READ"].includes(message.status)) continue;
      if (event.status !== "FAILED" && ranks[event.status] <= (ranks[message.status] || 0)) continue;
      await prisma.$transaction(async db => {
        await db.inboxMessage.update({ where: { id: message.id }, data: { status: event.status, errorCode: event.status === "FAILED" ? "PROVIDER_DELIVERY_FAILED" : null } });
        await db.inboxConversation.update({ where: { id: message.conversationId }, data: { updatedAt: new Date() } });
      });
    }
    return;
  }
  const duplicate = await prisma.inboxMessage.findUnique({ where: { channelId_externalMessageId: { channelId: channel.id, externalMessageId: event.messageId } } });
  if (duplicate) return;
  const enriched: IncomingEvent = { ...event };
  const knownIdentity = await prisma.contactIdentity.findUnique({ where: { channelId_externalUserId: { channelId: channel.id, externalUserId: event.chatId } }, select: { id: true } });
  if (!event.echo && !event.name && !knownIdentity) {
    try {
      const profile = await adapter(channel.type).fetchProfile({ accountId: channel.externalAccountId, chatId: event.chatId,
        credentials: decrypt<Credentials>(channel.credentialsEncrypted, channel.companyId), lastIncomingAt: event.at, subscribed: true });
      Object.assign(enriched, profile);
    } catch { /* Missing profile permission must not prevent message ingestion. */ }
  }
  await prisma.$transaction(async db => {
    if (event.echo && event.payload?.clientId) {
      const own = await db.inboxMessage.findFirst({ where: { companyId: channel.companyId, clientRequestId: String(event.payload.clientId), channelId: channel.id, direction: "OUT" } });
      if (own) { await db.inboxMessage.update({ where: { id: own.id }, data: { externalMessageId: event.messageId, status: "SENT", providerTimestamp: event.at } }); return; }
    }
    let conversation = await db.inboxConversation.findUnique({ where: { channelId_externalChatId: { channelId: channel.id, externalChatId: event.chatId } } });
    if (!conversation) {
      // Echoes can create history, but never generate a new sales lead or welcome reply.
      if (event.echo) return;
      const assignedUserId = await nextAgent(db, channel.companyId);
      const contactId = await resolveContact(db, channel, enriched, assignedUserId);
      const leadId = await resolveLead(db, channel, contactId, assignedUserId);
      conversation = await db.inboxConversation.create({ data: { companyId: channel.companyId, channelId: channel.id,
        contactId, leadId, externalChatId: event.chatId, assignedUserId } });
    }
    const direction = event.echo ? "OUT" : "IN";
    const message = await db.inboxMessage.create({ data: { companyId: channel.companyId, channelId: channel.id,
      conversationId: conversation.id, direction, externalMessageId: event.messageId, type: event.type,
      text: event.text?.slice(0, 20000), payloadJson: JSON.stringify(event.payload || {}), status: "SENT", providerTimestamp: event.at } });
    for (const source of event.media) {
      const attachment = await db.inboxAttachment.create({ data: { companyId: channel.companyId, messageId: message.id,
        name: source.name.slice(0, 200), sourceEncrypted: encrypt(source, channel.companyId) } });
      await enqueue(db, channel.companyId, "MEDIA", attachment.id);
    }
    const updated = await db.inboxConversation.update({ where: { id: conversation.id }, data: {
      lastMessageAt: event.at > conversation.lastMessageAt ? event.at : conversation.lastMessageAt,
      ...(!event.echo ? { lastIncomingAt: !conversation.lastIncomingAt || event.at > conversation.lastIncomingAt ? event.at : conversation.lastIncomingAt, status: "OPEN", subscribed: true } : {}),
    } });
    if (!event.echo) await scheduleAutoReply(db, channel, updated, event.at);
  });
}
export async function enqueue(db: Prisma.TransactionClient, companyId: string, kind: string, recordId: string) {
  return db.inboxOutboxEvent.upsert({ where: { kind_recordId: { kind, recordId } }, update: {}, create: { companyId, kind, recordId } });
}
export async function processWebhook(id: string) {
  const event = await prisma.inboxWebhookEvent.findUniqueOrThrow({ where: { id }, include: { integration: true } });
  if (event.status === "DONE" || event.integration.status !== "ACTIVE") return;
  await prisma.inboxWebhookEvent.update({ where: { id }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  try {
    const raw = decrypt<string>(event.payloadEncrypted, event.companyId);
    const JSONbig = (await import("json-bigint")).default({ storeAsString: true });
    const body = JSONbig.parse(raw);
    if (event.integration.provider === "VIBER") {
      const channel = await prisma.inboxChannel.findFirst({ where: { integrationId: event.integrationId, type: "VIBER" } });
      for (const parsed of adapter("VIBER").parseIncoming(body, channel?.externalAccountId)) await processEvent(event.integrationId, parsed);
    } else {
      for (const type of ["FACEBOOK", "INSTAGRAM", "WHATSAPP"]) for (const parsed of adapter(type).parseIncoming(body)) await processEvent(event.integrationId, parsed);
    }
    await prisma.inboxWebhookEvent.update({ where: { id }, data: { status: "DONE" } });
  } catch {
    await prisma.inboxWebhookEvent.update({ where: { id }, data: { status: "FAILED" } });
    throw new ChannelError("WEBHOOK_PROCESSING_FAILED", true);
  }
}
