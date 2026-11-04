import type { WorkspaceContext } from "../auth/workspace";
import { prisma } from "../db";
import { requireInbox } from "./access";
import { AppError } from "../errors";
export async function mergePreview(ctx: WorkspaceContext, sourceId: string, targetId: string) {
  requireInbox(ctx, true);
  if (sourceId === targetId) throw new AppError("Choose two different contacts", "INVALID_MERGE", 400);
  const records = await prisma.contact.findMany({ where: { companyId: ctx.company.id, id: { in: [sourceId, targetId] }, archivedAt: null },
    select: { id: true, firstName: true, lastName: true, phone: true, customerId: true, _count: { select: { inboxIdentities: true, inboxConversations: true, deals: true } } } });
  if (records.length !== 2) throw new AppError("Contact not found", "NOT_FOUND", 404);
  return { source: records.find(r => r.id === sourceId)!, target: records.find(r => r.id === targetId)! };
}
export async function mergeContacts(ctx: WorkspaceContext, sourceId: string, targetId: string) {
  await mergePreview(ctx, sourceId, targetId);
  return prisma.$transaction(async db => {
    const source = await db.contact.findFirstOrThrow({ where: { id: sourceId, companyId: ctx.company.id, archivedAt: null } });
    const target = await db.contact.findFirstOrThrow({ where: { id: targetId, companyId: ctx.company.id, archivedAt: null } });
    if (source.customerId && target.customerId && source.customerId !== target.customerId) throw new AppError("Contacts belong to different clients. Resolve their client links before merging.", "MERGE_CLIENT_CONFLICT", 409);
    const scope = { companyId: ctx.company.id, contactId: sourceId };
    await db.contactIdentity.updateMany({ where: scope, data: { contactId: targetId } });
    await db.inboxConversation.updateMany({ where: scope, data: { contactId: targetId, updatedAt: new Date() } });
    await db.note.updateMany({ where: scope, data: { contactId: targetId } });
    await db.deal.updateMany({ where: scope, data: { contactId: targetId } });
    await db.lead.updateMany({ where: scope, data: { contactId: targetId } });
    await db.contact.update({ where: { id: targetId }, data: { phone: target.phone || source.phone, email: target.email || source.email, customerId: target.customerId || source.customerId } });
    await db.contact.update({ where: { id: sourceId }, data: { archivedAt: new Date() } });
    await db.auditEvent.create({ data: { companyId: ctx.company.id, actorId: ctx.user.id, action: "inbox.contacts_merged", entityType: "contact", entityId: targetId, detail: JSON.stringify({ sourceId, targetId }) } });
    return { targetId };
  });
}
