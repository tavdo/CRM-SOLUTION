import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { createHmac } from "node:crypto";
import type { WorkspaceContext } from "../../src/lib/auth/workspace";
const fixture = vi.hoisted(() => ({ file: `${process.cwd().replaceAll("\\", "/")}/prisma/inbox-test-${process.pid}-${Date.now()}.db` }));
vi.mock("../../src/lib/db", async () => { const { PrismaClient } = await import("@prisma/client"); return { prisma: new PrismaClient({ datasourceUrl: `file:${fixture.file}?connection_limit=1` }) }; });
import { prisma } from "../../src/lib/db";
import { receiveWebhook, verifyChallenge } from "../../src/lib/inbox/webhooks";
import { processWebhook, processEvent } from "../../src/lib/inbox/processing";
import { dispatchOutbox } from "../../src/lib/inbox/queue";
import { sendQueued } from "../../src/lib/inbox/sending";
import { connectChannel, listConversations, getConversation, queueReply, updateConversation, markRead } from "../../src/lib/services/inbox";
import { mergeContacts } from "../../src/lib/inbox/merging";
import type { IncomingEvent } from "../../src/lib/inbox/types";
import { convertLead } from "../../src/lib/services/leads";
import { viber } from "../../src/lib/inbox/adapters/viber";

describe("tenant-scoped inbox workflows", () => {
  let admin: WorkspaceContext; let manager: WorkspaceContext; let employee: WorkspaceContext; let channel: Awaited<ReturnType<typeof connectChannel>>;
  beforeAll(async () => {
    process.env.INBOX_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64"); process.env.META_GRAPH_VERSION = "v24.0";
    for (const migration of readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort()) {
      for (const statement of readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8").split(";").map(v => v.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
    }
    const company = await prisma.company.create({ data: { id: "inbox-a", name: "Inbox A", slug: "inbox-a" } });
    await prisma.company.create({ data: { id: "inbox-b", name: "Inbox B", slug: "inbox-b" } });
    const user = await prisma.user.create({ data: { id: "admin", name: "Admin", email: "admin@inbox.test", passwordHash: "test" } });
    const membership = await prisma.membership.create({ data: { companyId: company.id, userId: user.id, role: "ADMIN" } });
    admin = { user, company, membership, role: "ADMIN", subscription: null };
    for (const id of ["manager", "employee", "manager-2"]) await prisma.user.create({ data: { id, name: id, email: `${id}@inbox.test`, passwordHash: "test" } });
    await prisma.membership.createMany({ data: [{ companyId: company.id, userId: "manager", role: "MANAGER" }, { companyId: company.id, userId: "manager-2", role: "MANAGER" }, { companyId: company.id, userId: "employee", role: "EMPLOYEE" }] });
    manager = { ...admin, role: "MANAGER", user: { ...user, id: "manager" } }; employee = { ...admin, role: "EMPLOYEE", user: { ...user, id: "employee" } };
    await prisma.inboxAgent.create({ data: { companyId: company.id, userId: "manager" } });
    channel = await connectChannel(admin, { name: "Test page", type: "FACEBOOK", externalAccountId: "page-1", accessToken: "fake-access-token", appSecret: "app-secret", verifyToken: "verify-token-long-enough" });
  }, 40000);
  afterAll(async () => { vi.unstubAllGlobals(); await prisma.$disconnect(); for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(fixture.file + suffix, { force: true }); });
  const incoming = (id: string, chatId = "psid-1", phone?: string): IncomingEvent => ({ kind: "message", accountId: "page-1", channelType: "FACEBOOK", chatId, messageId: id, at: new Date(), name: "Test Person", phone, type: "TEXT", text: "Hello", media: [] });
  it("stores signed callbacks durably, verifies challenges and processes duplicates once", async () => {
    expect(await verifyChallenge(channel.integrationId, "subscribe", "verify-token-long-enough", "challenge")).toBe("challenge");
    await expect(verifyChallenge(channel.integrationId, "subscribe", "wrong", "challenge")).rejects.toMatchObject({ status: 403 });
    const raw = JSON.stringify({ object: "page", entry: [{ id: "page-1", messaging: [{ sender: { id: "psid-1" }, recipient: { id: "page-1" }, timestamp: Date.now(), message: { mid: "first", text: "Hello" } }] }] });
    const signature = `sha256=${createHmac("sha256", "app-secret").update(raw).digest("hex")}`;
    await expect(receiveWebhook(channel.integrationId, "META", raw, "bad")).rejects.toMatchObject({ status: 401 });
    await receiveWebhook(channel.integrationId, "META", raw, signature); await receiveWebhook(channel.integrationId, "META", raw, signature);
    expect(await prisma.inboxWebhookEvent.count()).toBe(1);
    const persisted = await prisma.inboxWebhookEvent.findFirstOrThrow(); expect(persisted.payloadEncrypted).not.toContain("Hello");
    const add = vi.fn().mockRejectedValueOnce(new Error("redis unavailable")).mockResolvedValue({});
    await expect(dispatchOutbox({ add })).rejects.toThrow();
    expect(await prisma.inboxOutboxEvent.count({ where: { dispatchedAt: null } })).toBe(1);
    await dispatchOutbox({ add }); await processWebhook(persisted.id); await processWebhook(persisted.id);
    expect(await prisma.inboxMessage.count()).toBe(1); expect(await prisma.contact.count()).toBe(1); expect(await prisma.lead.count()).toBe(1);
  });
  it("links a unique same-tenant phone and refuses ambiguous/cross-tenant matches", async () => {
    const contact = await prisma.contact.create({ data: { companyId: admin.company.id, firstName: "Existing", lastName: "Client", phone: "555 12 34 56" } });
    await prisma.contact.create({ data: { companyId: "inbox-b", firstName: "Foreign", lastName: "Person", phone: "+995555123456" } });
    await processEvent(channel.integrationId, incoming("phone-match", "phone-chat", "555 12 34 56"));
    expect((await prisma.contactIdentity.findUniqueOrThrow({ where: { channelId_externalUserId: { channelId: channel.id, externalUserId: "phone-chat" } } })).contactId).toBe(contact.id);
    await prisma.contact.create({ data: { companyId: admin.company.id, firstName: "Duplicate", lastName: "Client", phone: "+995555123456" } });
    await processEvent(channel.integrationId, incoming("phone-ambiguous", "ambiguous-chat", "+995555123456"));
    const ambiguous = await prisma.contactIdentity.findUniqueOrThrow({ where: { channelId_externalUserId: { channelId: channel.id, externalUserId: "ambiguous-chat" } } });
    expect(ambiguous.contactId).not.toBe(contact.id);
  });
  it("enforces assignment restrictions even for managers with crm.all", async () => {
    const row = await prisma.inboxConversation.findFirstOrThrow();
    expect((await listConversations(manager)).length).toBeGreaterThan(0);
    await updateConversation(admin, row.id, { assignedUserId: "manager-2" });
    await expect(getConversation(manager, row.id)).rejects.toMatchObject({ status: 404 });
    await expect(queueReply(manager, row.id, { text: "hidden", clientRequestId: crypto.randomUUID() })).rejects.toMatchObject({ status: 404 });
    await expect(listConversations(employee)).rejects.toMatchObject({ status: 403 });
    await expect(connectChannel(manager, {})).rejects.toMatchObject({ status: 403 });
    expect(await listConversations({ ...admin, company: { ...admin.company, id: "inbox-b" } })).toEqual([]);
  });
  it("queues idempotent replies, keeps notes private and preserves read-state ordering", async () => {
    const row = await prisma.inboxConversation.findFirstOrThrow();
    const clientRequestId = crypto.randomUUID();
    const first = await queueReply(admin, row.id, { text: "Reply", clientRequestId });
    expect((await queueReply(admin, row.id, { text: "Reply", clientRequestId })).id).toBe(first.id);
    await updateConversation(admin, row.id, { note: "Private note" });
    const detail = await getConversation(admin, row.id);
    expect(detail.notes).toHaveLength(1); expect(detail.messages.some(m => m.text === "Private note")).toBe(false);
    await markRead(admin, row.id);
    expect((await listConversations(admin)).find(c => c.id === row.id)?.unreadCount).toBe(0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message_id: "sent-1" }), { status: 200 })));
    await sendQueued(first.id);
    await processEvent(channel.integrationId, { kind: "status", accountId: "page-1", channelType: "FACEBOOK", messageIds: ["sent-1"], status: "READ" });
    await processEvent(channel.integrationId, { kind: "status", accountId: "page-1", channelType: "FACEBOOK", messageIds: ["sent-1"], status: "DELIVERED" });
    expect((await prisma.inboxMessage.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("READ");
    vi.unstubAllGlobals();
  });
  it("retries recoverable failures but never blindly repeats ambiguous sends", async () => {
    const row = await prisma.inboxConversation.findFirstOrThrow();
    const message = await queueReply(admin, row.id, { text: "retry", clientRequestId: crypto.randomUUID() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 4, is_transient: true } }), { status: 429 })));
    await expect(sendQueued(message.id)).rejects.toMatchObject({ retryable: true });
    expect((await prisma.inboxMessage.findUniqueOrThrow({ where: { id: message.id } })).status).toBe("QUEUED");
    const timeout = vi.fn().mockRejectedValue(new Error("timeout")); vi.stubGlobal("fetch", timeout);
    await sendQueued(message.id); await sendQueued(message.id);
    expect((await prisma.inboxMessage.findUniqueOrThrow({ where: { id: message.id } })).status).toBe("UNCERTAIN"); expect(timeout).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it("merges identities and history without losing audit or crossing tenants", async () => {
    const rows = await prisma.contact.findMany({ where: { companyId: admin.company.id, archivedAt: null }, take: 2 });
    const before = await prisma.inboxConversation.count();
    await expect(mergeContacts(manager, rows[0].id, rows[1].id)).rejects.toMatchObject({ status: 403 });
    await mergeContacts(admin, rows[0].id, rows[1].id);
    expect(await prisma.inboxConversation.count()).toBe(before);
    expect(await prisma.contactIdentity.count({ where: { contactId: rows[0].id } })).toBe(0);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: rows[0].id } })).archivedAt).not.toBeNull();
  });
  it("round-robins available managers and schedules welcome replies only once", async () => {
    await prisma.inboxAgent.create({ data: { companyId: admin.company.id, userId: "manager-2" } });
    await prisma.inboxChannel.update({ where: { id: channel.id }, data: { settingsJson: JSON.stringify({ welcome: "Welcome!", away: "", timezone: "UTC", startHour: 0, endHour: 24, workDays: [0, 1, 2, 3, 4, 5, 6] }) } });
    await processEvent(channel.integrationId, incoming("round-robin-1", "new-round-robin-chat"));
    const conversation = await prisma.inboxConversation.findUniqueOrThrow({ where: { channelId_externalChatId: { channelId: channel.id, externalChatId: "new-round-robin-chat" } } });
    expect(conversation.assignedUserId).toBe("manager-2");
    await processEvent(channel.integrationId, incoming("round-robin-2", "new-round-robin-chat"));
    expect(await prisma.inboxMessage.count({ where: { conversationId: conversation.id, text: "Welcome!", direction: "OUT" } })).toBe(1);
    await prisma.inboxChannel.update({ where: { id: channel.id }, data: { settingsJson: "{}" } });
  });
  it("preserves the canonical contact and channel history during lead conversion", async () => {
    await prisma.pipelineStage.create({ data: { companyId: admin.company.id, name: "New", sortOrder: 0 } });
    const conversation = await prisma.inboxConversation.findUniqueOrThrow({ where: { channelId_externalChatId: { channelId: channel.id, externalChatId: "new-round-robin-chat" } } });
    const before = await prisma.contact.count();
    const converted = await convertLead(admin, conversation.leadId!);
    expect(await prisma.contact.count()).toBe(before);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: conversation.contactId } })).customerId).toBe(converted.customer.id);
    expect((await prisma.inboxConversation.findUniqueOrThrow({ where: { id: conversation.id } })).contactId).toBe(conversation.contactId);
    expect(converted.deal.contactId).toBe(conversation.contactId);
    const secondLead = await prisma.lead.create({ data: { companyId: admin.company.id, contactId: conversation.contactId, title: "Repeat inquiry", contactName: "Repeat client", ownerId: admin.user.id } });
    const customerCount = await prisma.customer.count();
    expect((await convertLead(admin, secondLead.id)).customer.id).toBe(converted.customer.id);
    expect(await prisma.customer.count()).toBe(customerCount);
  });
  it("reconciles provider echoes that arrive before the send API response", async () => {
    const conversation = await prisma.inboxConversation.findFirstOrThrow();
    const pending = await queueReply(admin, conversation.id, { text: "Echo race", clientRequestId: crypto.randomUUID() });
    const fetchMock = vi.fn().mockImplementation(async () => {
      await processEvent(channel.integrationId, { ...incoming("echo-race-id", conversation.externalChatId), echo: true, text: "Echo race" });
      return new Response(JSON.stringify({ message_id: "echo-race-id" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock); await sendQueued(pending.id); vi.unstubAllGlobals();
    expect(await prisma.inboxMessage.count({ where: { channelId: channel.id, externalMessageId: "echo-race-id" } })).toBe(1);
    expect((await prisma.inboxMessage.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("SENT");
  });
  it("scopes external identities by channel while linking a unique phone across channels", async () => {
    const ig = await connectChannel(admin, { name: "Instagram", type: "INSTAGRAM", externalAccountId: "ig-1", accessToken: "fake-ig-token", integrationId: channel.integrationId });
    const known = await prisma.contact.create({ data: { companyId: admin.company.id, firstName: "International", lastName: "Client", phone: "+12025550123" } });
    await processEvent(channel.integrationId, { ...incoming("ig-cross-channel", "psid-1", "+12025550123"), channelType: "INSTAGRAM", accountId: "ig-1" });
    const identity = await prisma.contactIdentity.findUniqueOrThrow({ where: { channelId_externalUserId: { channelId: ig.id, externalUserId: "psid-1" } } });
    expect(identity.contactId).toBe(known.id);
    expect(await prisma.contactIdentity.count({ where: { externalUserId: "psid-1" } })).toBe(2);
  });
  it("ingests signed Viber callbacks without rounding the provider message token", async () => {
    const bot = await connectChannel(admin, { name: "Bot", type: "VIBER", externalAccountId: "bot-1", accessToken: "fake-viber-token", verifyToken: "viber-verify-token-long" });
    const raw = readFileSync("tests/fixtures/inbox/viber.json", "utf8");
    const signature = createHmac("sha256", "fake-viber-token").update(raw).digest("hex");
    await receiveWebhook(bot.integrationId, "VIBER", raw, signature, viber.verifyWebhook);
    const event = await prisma.inboxWebhookEvent.findFirstOrThrow({ where: { integrationId: bot.integrationId } });
    await processWebhook(event.id);
    expect(await prisma.inboxMessage.findUnique({ where: { channelId_externalMessageId: { channelId: bot.id, externalMessageId: "5741311803571721087" } } })).not.toBeNull();
  });
});
