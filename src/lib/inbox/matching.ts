import type { InboxChannel, Prisma } from "@prisma/client";
import { normalizePhone } from "../normalization";
import type { IncomingEvent } from "./types";

export function phoneOrNull(value?: string) {
  try { return normalizePhone(value); } catch { return null; }
}
export async function phoneMatches(db: Prisma.TransactionClient, companyId: string, phone: string, take = 2) {
  const matches: { id: string; firstName: string; lastName: string; phone: string | null }[] = [];
  let cursor: string | undefined;
  while (matches.length < take) {
    const rows = await db.contact.findMany({ where: { companyId, archivedAt: null, phone: { not: null } },
      orderBy: { id: "asc" }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, firstName: true, lastName: true, phone: true } });
    for (const row of rows) if (phoneOrNull(row.phone || undefined) === phone) { matches.push(row); if (matches.length >= take) break; }
    if (rows.length < 200) break;
    cursor = rows[rows.length - 1].id;
  }
  return matches;
}
export async function resolveContact(db: Prisma.TransactionClient, channel: InboxChannel, event: IncomingEvent, ownerId: string | null) {
  const companyId = channel.companyId;
  const identity = await db.contactIdentity.findUnique({ where: { channelId_externalUserId: { channelId: channel.id, externalUserId: event.chatId } } });
  if (identity && identity.companyId === companyId) return identity.contactId;
  const phone = phoneOrNull(event.phone);
  const matches = phone ? await phoneMatches(db, companyId, phone) : [];
  let contact = matches.length === 1 ? matches[0] : null;
  if (!contact) {
    const name = event.name?.normalize("NFC").trim() || `${channel.type} ${event.chatId.slice(-8)}`;
    const [firstName, ...rest] = name.split(/\s+/);
    contact = await db.contact.create({ data: { companyId, firstName, lastName: rest.join(" "), phone, ownerId } });
  }
  await db.contactIdentity.create({ data: { companyId, contactId: contact.id, channelId: channel.id, channelType: channel.type,
    externalUserId: event.chatId, displayName: event.name, avatarUrl: event.avatar, phone } });
  return contact.id;
}
export async function resolveLead(db: Prisma.TransactionClient, channel: InboxChannel, contactId: string, ownerId: string | null) {
  const companyId = channel.companyId;
  const contact = await db.contact.findFirstOrThrow({ where: { id: contactId, companyId } });
  let lead = await db.lead.findFirst({ where: { companyId, contactId, status: { notIn: ["CONVERTED", "JUNK"] } } });
  if (!lead && contact.phone) {
    const matches = await db.lead.findMany({ where: { companyId, contactId: null, phone: contact.phone, status: { notIn: ["CONVERTED", "JUNK"] } }, take: 2 });
    if (matches.length === 1) lead = await db.lead.update({ where: { id: matches[0].id }, data: { contactId } });
  }
  // Existing clients do not need a second sales lead for every new conversation.
  if (contact.customerId) return lead?.id ?? null;
  if (!lead) {
    const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
    const name = `${contact.firstName} ${contact.lastName}`.trim();
    lead = await db.lead.create({ data: { companyId, contactId, ownerId, contactName: name, title: `${channel.name}: ${name}`, phone: contact.phone,
      source: channel.type, currency: company.currency } });
  }
  return lead.id;
}
