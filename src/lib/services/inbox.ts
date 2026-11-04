import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceContext } from "../auth/workspace";
import { prisma } from "../db";
import { AppError } from "../errors";
import { inboxScope, requireInbox } from "../inbox/access";
import { enqueue } from "../inbox/processing";
import { audit } from "../inbox/http";
import { encrypt, decrypt, digest } from "../inbox/credentials";
import { adapter } from "../inbox/registry";
import { channelTypes, ChannelError, type Credentials } from "../inbox/types";
import { assertWindow } from "../inbox/adapters/meta-shared";
import { viberRequest } from "../inbox/adapters/viber";

export const channelSelect = { id: true, name: true, type: true, status: true, externalAccountId: true, integrationId: true, lastCheckedAt: true, lastError: true, settingsJson: true } as const;
export async function listChannels(ctx: WorkspaceContext) {
  requireInbox(ctx);
  return prisma.inboxChannel.findMany({ where: { companyId: ctx.company.id }, select: channelSelect, orderBy: { name: "asc" } });
}
export async function listConversations(ctx: WorkspaceContext, filters: { channel?: string; status?: string; assigned?: string; unread?: string; q?: string; contactId?: string; leadId?: string; customerId?: string } = {}) {
  const q = filters.q?.trim().slice(0, 120);
  const rows = await prisma.inboxConversation.findMany({ where: { AND: [inboxScope(ctx), {
    ...(filters.channel ? { channelId: filters.channel } : {}), ...(filters.status ? { status: filters.status } : {}),
    ...(filters.assigned && ctx.role === "ADMIN" ? { assignedUserId: filters.assigned === "unassigned" ? null : filters.assigned } : {}),
    ...(filters.contactId ? { contactId: filters.contactId } : {}), ...(filters.leadId ? { leadId: filters.leadId } : {}),
    ...(filters.customerId ? { contact: { customerId: filters.customerId, companyId: ctx.company.id } } : {}),
    ...(q ? { OR: [{ contact: { firstName: { contains: q } } }, { contact: { lastName: { contains: q } } },
      { messages: { some: { companyId: ctx.company.id, text: { contains: q } } } }] } : {}),
  }] }, include: { channel: { select: { id: true, name: true, type: true, status: true } },
    contact: { select: { id: true, firstName: true, lastName: true, phone: true, customerId: true } },
    messages: { where: { status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 1, select: { text: true, type: true, status: true } },
    readCursors: { where: { userId: ctx.user.id } } }, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: 200 });
  const counts = rows.length ? await prisma.inboxMessage.groupBy({ by: ["conversationId"], where: { companyId: ctx.company.id, direction: "IN",
    OR: rows.map(row => ({ conversationId: row.id, createdAt: { gt: row.readCursors[0]?.readAt || new Date(0) } })) }, _count: { _all: true } }) : [];
  const unread = new Map(counts.map(row => [row.conversationId, row._count._all]));
  const result = rows.map(row => ({ ...row, readCursors: undefined, unreadCount: unread.get(row.id) || 0 }));
  return filters.unread === "true" ? result.filter(row => row.unreadCount > 0) : result;
}
export async function conversationAccess(ctx: WorkspaceContext, id: string) {
  const record = await prisma.inboxConversation.findFirst({ where: { AND: [inboxScope(ctx), { id }] }, include: { channel: true } });
  if (!record) throw new AppError("Conversation not found", "NOT_FOUND", 404);
  return record;
}
export async function getConversation(ctx: WorkspaceContext, id: string, before?: string) {
  const conversation = await conversationAccess(ctx, id);
  const cursor = before ? await prisma.inboxMessage.findFirst({ where: { id: before, conversationId: id, companyId: ctx.company.id } }) : null;
  const messages = await prisma.inboxMessage.findMany({ where: { companyId: ctx.company.id, conversationId: id, status: { not: "DRAFT" },
    ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    select: { id: true, direction: true, type: true, text: true, payloadJson: true, status: true, errorCode: true, createdAt: true, sentByUserId: true,
      attachments: { select: { id: true, name: true, mimeType: true, size: true, status: true, errorCode: true } } } });
  const notes = await prisma.inboxInternalNote.findMany({ where: { companyId: ctx.company.id, conversationId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  const contact = await prisma.contact.findFirstOrThrow({ where: { id: conversation.contactId, companyId: ctx.company.id }, select: { id: true, firstName: true, lastName: true, phone: true, customerId: true } });
  return { conversation: { id, status: conversation.status, assignedUserId: conversation.assignedUserId, contactId: conversation.contactId, leadId: conversation.leadId,
    lastIncomingAt: conversation.lastIncomingAt, channel: { id: conversation.channel.id, type: conversation.channel.type, name: conversation.channel.name, status: conversation.channel.status }, contact },
    messages: messages.reverse(), nextCursor: messages.length === 50 ? messages[0].id : null, notes };
}
export async function queueReply(ctx: WorkspaceContext, id: string, input: unknown) {
  const data = z.object({ text: z.string().trim().max(4000).default(""), type: z.enum(["TEXT", "IMAGE", "FILE", "AUDIO", "VIDEO", "TEMPLATE"]).default("TEXT"),
    clientRequestId: z.string().uuid(), attachmentId: z.string().optional(), template: z.object({ name: z.string().regex(/^[a-z0-9_]+$/), language: z.string().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/), parameters: z.array(z.string().max(1000)).max(20).default([]) }).optional() }).parse(input);
  if (!data.text && !data.attachmentId && data.type !== "TEMPLATE") throw new AppError("Message is empty", "EMPTY_MESSAGE", 400);
  return prisma.$transaction(async db => {
    const conversation = await db.inboxConversation.findFirst({ where: { AND: [inboxScope(ctx), { id }] }, include: { channel: true } });
    if (!conversation) throw new AppError("Not found", "NOT_FOUND", 404);
    if (conversation.channel.status !== "ACTIVE") throw new AppError("Channel is disconnected", "CHANNEL_DISCONNECTED", 409);
    try {
      if (data.type !== "TEMPLATE" && conversation.channel.type !== "VIBER") assertWindow({ accountId: "", chatId: "", credentials: { accessToken: "" }, lastIncomingAt: conversation.lastIncomingAt, subscribed: conversation.subscribed });
    } catch { throw new AppError("The reply window is closed. Use an approved WhatsApp template if available.", "SERVICE_WINDOW_CLOSED", 409); }
    if (data.type === "TEMPLATE" && (conversation.channel.type !== "WHATSAPP" || !data.template)) throw new AppError("Template is not supported", "INVALID_TEMPLATE", 400);
    const duplicate = await db.inboxMessage.findUnique({ where: { companyId_clientRequestId: { companyId: ctx.company.id, clientRequestId: data.clientRequestId } } });
    if (duplicate) {
      if (duplicate.conversationId !== id) throw new AppError("Request identifier already used", "CONFLICT", 409);
      return { id: duplicate.id };
    }
    if (await db.inboxMessage.count({ where: { companyId: ctx.company.id, sentByUserId: ctx.user.id, createdAt: { gt: new Date(Date.now() - 60000) } } }) >= 30) throw new AppError("Please slow down", "RATE_LIMIT", 429);
    let attachment = null;
    if (data.attachmentId) {
      attachment = await db.inboxAttachment.findFirst({ where: { id: data.attachmentId, companyId: ctx.company.id, status: "READY", message: { conversationId: id, sentByUserId: ctx.user.id, status: "DRAFT" } } });
      if (!attachment) throw new AppError("Attachment not found", "NOT_FOUND", 404);
    }
    const payloadJson = JSON.stringify(data.template ? { template: data.template } : {});
    const message = attachment ? await db.inboxMessage.update({ where: { id: attachment.messageId }, data: { text: data.text, type: data.type, payloadJson, status: "QUEUED", clientRequestId: data.clientRequestId } })
      : await db.inboxMessage.create({ data: { companyId: ctx.company.id, channelId: conversation.channelId, conversationId: id, sentByUserId: ctx.user.id,
        direction: "OUT", type: data.type, text: data.text, status: "QUEUED", payloadJson, clientRequestId: data.clientRequestId } });
    await enqueue(db, ctx.company.id, "SEND", message.id);
    await db.inboxConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return { id: message.id };
  });
}
export async function markRead(ctx: WorkspaceContext, id: string) {
  await conversationAccess(ctx, id);
  // Read only messages already in the database; a concurrent arrival remains unread.
  const latest = await prisma.inboxMessage.findFirst({ where: { companyId: ctx.company.id, conversationId: id, direction: "IN" }, orderBy: { createdAt: "desc" } });
  if (!latest) return;
  await prisma.inboxReadCursor.upsert({ where: { conversationId_userId: { conversationId: id, userId: ctx.user.id } },
    create: { companyId: ctx.company.id, conversationId: id, userId: ctx.user.id, readAt: latest.createdAt }, update: { readAt: latest.createdAt } });
}
export async function updateConversation(ctx: WorkspaceContext, id: string, input: unknown) {
  requireInbox(ctx);
  const data = z.object({ status: z.enum(["OPEN", "PENDING", "CLOSED"]).optional(), assignedUserId: z.string().nullable().optional(), take: z.boolean().optional(), note: z.string().trim().min(1).max(5000).optional() }).parse(input);
  await prisma.$transaction(async db => {
    if (data.take) {
      const result = await db.inboxConversation.updateMany({ where: { id, companyId: ctx.company.id, assignedUserId: null }, data: { assignedUserId: ctx.user.id } });
      if (!result.count) throw new AppError("Conversation was already assigned", "CONFLICT", 409);
      return;
    }
    if (!await db.inboxConversation.findFirst({ where: { AND: [inboxScope(ctx), { id }] } })) throw new AppError("Not found", "NOT_FOUND", 404);
    if (data.assignedUserId !== undefined) {
      requireInbox(ctx, true);
      if (data.assignedUserId && !await db.membership.findFirst({ where: { companyId: ctx.company.id, userId: data.assignedUserId, role: { in: ["ADMIN", "MANAGER"] } } })) throw new AppError("Invalid manager", "INVALID_ASSIGNEE", 400);
    }
    if (data.note) await db.inboxInternalNote.create({ data: { companyId: ctx.company.id, conversationId: id, userId: ctx.user.id, text: data.note } });
    await db.inboxConversation.update({ where: { id }, data: { ...(data.status ? { status: data.status } : {}), ...(data.assignedUserId !== undefined ? { assignedUserId: data.assignedUserId } : {}), updatedAt: new Date() } });
  });
  await audit(ctx, data.take ? "inbox.taken" : data.note ? "inbox.note_added" : "inbox.updated", id);
}
export async function connectChannel(ctx: WorkspaceContext, input: unknown) {
  requireInbox(ctx, true);
  const data = z.object({ name: z.string().trim().min(1).max(100), type: z.enum(channelTypes), externalAccountId: z.string().trim().min(1).max(150),
    accessToken: z.string().min(10).max(4096), appSecret: z.string().max(300).default(""), verifyToken: z.string().max(200).default(""), integrationId: z.string().optional() }).parse(input);
  if (!data.integrationId && data.verifyToken.length < 16) throw new AppError("Verify token must have at least 16 characters", "INVALID_INPUT", 400);
  adapter(data.type);
  if (data.type !== "VIBER" && !data.appSecret && !data.integrationId) throw new AppError("Meta app secret is required", "SECRET_REQUIRED", 400);
  const provider = data.type === "VIBER" ? "VIBER" : "META";
  const channel = await prisma.$transaction(async db => {
    const existing = await db.inboxChannel.findFirst({ where: { companyId: ctx.company.id, type: data.type, externalAccountId: data.externalAccountId } });
    if (existing && data.type !== "VIBER" && data.integrationId !== existing.integrationId) throw new AppError("Select the original Meta app connection to reconnect this account", "APP_CONNECTION_REQUIRED", 409);
    const integrationId = data.integrationId || (data.type === "VIBER" ? existing?.integrationId : undefined);
    let integration = integrationId ? await db.inboxIntegration.findFirst({ where: { id: integrationId, companyId: ctx.company.id, provider } }) : null;
    if (data.integrationId && !integration) throw new AppError("Integration not found", "NOT_FOUND", 404);
    if (!integration) integration = await db.inboxIntegration.create({ data: { companyId: ctx.company.id, provider, name: data.name,
      credentialsEncrypted: encrypt({ accessToken: provider === "VIBER" ? data.accessToken : "", appSecret: data.appSecret, verifyToken: data.verifyToken }, ctx.company.id), verifyTokenHash: digest(data.verifyToken) } });
    else if (data.type === "VIBER") await db.inboxIntegration.update({ where: { id: integration.id }, data: { status: "ACTIVE", credentialsEncrypted: encrypt({ accessToken: data.accessToken }, ctx.company.id) } });
    return db.inboxChannel.upsert({ where: { integrationId_type_externalAccountId: { integrationId: integration.id, type: data.type, externalAccountId: data.externalAccountId } },
      update: { name: data.name, status: "ACTIVE", credentialsEncrypted: encrypt({ accessToken: data.accessToken }, ctx.company.id), lastError: null, lastCheckedAt: null },
      create: { companyId: ctx.company.id, integrationId: integration.id, type: data.type, name: data.name, externalAccountId: data.externalAccountId, credentialsEncrypted: encrypt({ accessToken: data.accessToken }, ctx.company.id) }, select: channelSelect });
  });
  await audit(ctx, "inbox.channel_connected", channel.id);
  return { ...channel, verificationToken: data.integrationId ? undefined : data.verifyToken };
}
export async function checkChannel(ctx: WorkspaceContext, id: string) {
  requireInbox(ctx, true);
  const channel = await prisma.inboxChannel.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!channel) throw new AppError("Not found", "NOT_FOUND", 404);
  let code: string | null = null;
  try {
    const credentials = decrypt<Credentials>(channel.credentialsEncrypted, ctx.company.id);
    await adapter(channel.type).checkConnection(channel.externalAccountId, credentials);
    if (channel.type === "VIBER") {
      const base = process.env.APP_URL;
      if (!base?.startsWith("https://")) throw new ChannelError("PUBLIC_HTTPS_URL_REQUIRED");
      await viberRequest("set_webhook", credentials.accessToken, { url: `${base.replace(/\/$/, "")}/api/inbox/webhooks/viber/${channel.integrationId}`, event_types: ["delivered", "seen", "failed", "subscribed", "unsubscribed", "conversation_started"], send_name: true, send_photo: true });
    }
  }
  catch (error) { code = error instanceof ChannelError ? error.code : "CONNECTION_FAILED"; }
  await prisma.inboxChannel.update({ where: { id }, data: { lastCheckedAt: new Date(), lastError: code } });
  return { ok: !code, code };
}
export async function disconnectChannel(ctx: WorkspaceContext, id: string) {
  requireInbox(ctx, true);
  const channel = await prisma.inboxChannel.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!channel) throw new AppError("Not found", "NOT_FOUND", 404);
  let code: string | null = null;
  if (channel.type === "VIBER") {
    try { await viberRequest("set_webhook", decrypt<Credentials>(channel.credentialsEncrypted, ctx.company.id).accessToken, { url: "" }); }
    catch { code = "VIBER_REMOTE_DISCONNECT_FAILED"; }
  }
  await prisma.inboxChannel.update({ where: { id }, data: { status: "DISCONNECTED", lastError: code } });
  await audit(ctx, "inbox.channel_disconnected", id);
  return { ok: !code, code };
}
export async function inboxBootstrap(ctx: WorkspaceContext) {
  requireInbox(ctx);
  const [channels, members, quickReplies, agent] = await Promise.all([listChannels(ctx),
    prisma.membership.findMany({ where: { companyId: ctx.company.id, role: { in: ["ADMIN", "MANAGER"] } }, select: { userId: true, user: { select: { name: true } } } }),
    prisma.inboxQuickReply.findMany({ where: { companyId: ctx.company.id } }),
    prisma.inboxAgent.findUnique({ where: { companyId_userId: { companyId: ctx.company.id, userId: ctx.user.id } } })]);
  return { channels, members, quickReplies, available: agent?.available || false, userId: ctx.user.id, admin: ctx.role === "ADMIN", nonce: randomUUID() };
}
