import type { InboxChannel, InboxConversation, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
const settingsSchema = z.object({ welcome: z.string(), away: z.string(), timezone: z.string(), startHour: z.number(), endHour: z.number(), workDays: z.array(z.number()) });
export function outsideHours(settings: z.infer<typeof settingsSchema>, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find(p => p.type === "weekday")?.value || "");
  const hour = Number(parts.find(p => p.type === "hour")?.value);
  return !settings.workDays.includes(day) || hour < settings.startHour || hour >= settings.endHour;
}
export async function scheduleAutoReply(db: Prisma.TransactionClient, channel: InboxChannel, conversation: InboxConversation, incomingAt: Date) {
  const parsed = settingsSchema.safeParse(JSON.parse(channel.settingsJson));
  if (!parsed.success || Date.now() - incomingAt.getTime() >= 86400000 || !conversation.subscribed) return;
  const settings = parsed.data; const away = outsideHours(settings, new Date());
  const text = away ? settings.away : !conversation.welcomeSentAt ? settings.welcome : "";
  if (!text || (away && conversation.awaySentAt && Date.now() - conversation.awaySentAt.getTime() < 86400000)) return;
  const message = await db.inboxMessage.create({ data: { companyId: channel.companyId, channelId: channel.id, conversationId: conversation.id,
    direction: "OUT", text, status: "QUEUED", clientRequestId: randomUUID(), payloadJson: JSON.stringify({ automated: true }) } });
  await db.inboxOutboxEvent.create({ data: { companyId: channel.companyId, kind: "SEND", recordId: message.id } });
  await db.inboxConversation.update({ where: { id: conversation.id }, data: away ? { awaySentAt: new Date() } : { welcomeSentAt: new Date() } });
}
