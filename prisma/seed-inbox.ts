import { PrismaClient } from "@prisma/client";
import { encrypt, digest } from "../src/lib/inbox/credentials";
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Inbox fixtures are development-only");
  const admin = await db.user.findUnique({ where: { id: "workspace_admin" } });
  if (!admin) throw new Error("Run the normal workspace seed first");
  const companyId = "inbox_sandbox";
  await db.$transaction(async tx => {
    await tx.company.upsert({ where: { id: companyId }, update: {}, create: { id: companyId, slug: "inbox-sandbox", name: "Inbox Sandbox" } });
    for (const [userId, role] of [["workspace_admin", "ADMIN"], ["workspace_manager", "MANAGER"]] as const) {
      await tx.membership.upsert({ where: { companyId_userId: { companyId, userId } }, update: {}, create: { companyId, userId, role } });
      await tx.inboxAgent.upsert({ where: { companyId_userId: { companyId, userId } }, update: {}, create: { companyId, userId } });
    }
    const contactId = "inbox_sample_contact";
    await tx.contact.upsert({ where: { id: contactId }, update: {}, create: { id: contactId, companyId, firstName: "Sample", lastName: "Client", ownerId: admin.id } });
    for (const type of ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "VIBER"]) {
      const integrationId = `inbox_sample_${type}`; const channelId = `${integrationId}_channel`; const conversationId = `${integrationId}_conversation`;
      await tx.inboxIntegration.upsert({ where: { id: integrationId }, update: {}, create: { id: integrationId, companyId, provider: type === "VIBER" ? "VIBER" : "META", name: `Sample ${type}`, status: "DISCONNECTED", verifyTokenHash: digest("sample-only-not-a-real-token"), credentialsEncrypted: encrypt({ accessToken: "sample-only", appSecret: "sample-only" }, companyId) } });
      await tx.inboxChannel.upsert({ where: { id: channelId }, update: {}, create: { id: channelId, companyId, integrationId, type, externalAccountId: `sample-${type}`, name: `Sample ${type}`, status: "DISCONNECTED", credentialsEncrypted: encrypt({ accessToken: "sample-only" }, companyId) } });
      await tx.contactIdentity.upsert({ where: { channelId_externalUserId: { channelId, externalUserId: "sample-client" } }, update: {}, create: { companyId, channelId, contactId, channelType: type, externalUserId: "sample-client" } });
      await tx.inboxConversation.upsert({ where: { id: conversationId }, update: {}, create: { id: conversationId, companyId, channelId, contactId, externalChatId: "sample-client", assignedUserId: "workspace_manager", lastIncomingAt: new Date() } });
      await tx.inboxMessage.upsert({ where: { id: `${integrationId}_message` }, update: {}, create: { id: `${integrationId}_message`, companyId, channelId, conversationId, direction: "IN", text: `Sample ${type} conversation. This disconnected fixture never contacts a provider.`, status: "SENT", externalMessageId: `sample-${type}` } });
    }
    if (!await tx.inboxQuickReply.count({ where: { companyId } })) await tx.inboxQuickReply.create({ data: { companyId, title: "Thank you", text: "Thank you for your message. How can we help?" } });
  });
  console.log("Inbox Sandbox ready. Switch workspace in the sidebar. All sample channels are disconnected.");
}
main().catch(() => { console.error("Inbox seed failed. Check migrations, the local encryption key and workspace seed."); process.exitCode = 1; }).finally(() => db.$disconnect());
