import Link from "next/link";
import { prisma } from "@/lib/db";
import { inboxScope } from "@/lib/inbox/access";
import type { WorkspaceContext } from "@/lib/auth/workspace";
export async function ContactTimeline({ ctx, locale, contactId, customerId, leadId }: { ctx: WorkspaceContext; locale: string; contactId?: string; customerId?: string; leadId?: string }) {
  if (ctx.role === "EMPLOYEE") return null;
  const conversations = { AND: [inboxScope(ctx), { ...(contactId ? { contactId } : {}), ...(leadId ? { leadId } : {}), ...(customerId ? { contact: { companyId: ctx.company.id, customerId } } : {}) }] };
  const messages = await prisma.inboxMessage.findMany({ where: { companyId: ctx.company.id, status: { not: "DRAFT" }, conversation: conversations },
    include: { conversation: { select: { channel: { select: { name: true, type: true } } } }, attachments: { select: { id: true, name: true, status: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return <div className="inbox-timeline">{!messages.length && <p className="muted">{locale === "ka" ? "ხილული შეტყობინებები ჯერ არ არის." : "No visible messages yet."}</p>}{messages.map(message => <article key={message.id}>
    <div className="construction-row"><strong>{message.conversation.channel.name} · {message.direction === "IN" ? "←" : "→"}</strong><small className="muted">{new Date(message.createdAt).toLocaleString(locale)} · {message.status}</small></div>
    <p>{message.text || message.type}</p>{message.attachments.map(a => <p key={a.id}>{a.status === "READY" ? <a href={`/api/inbox/attachments/${a.id}`}>{a.name} ↗</a> : `${a.name} · ${a.status}`}</p>)}
    <Link className="btn btn-secondary" href={`/${locale}/inbox?conversation=${message.conversationId}`}>{locale === "ka" ? "საუბრის გახსნა" : "Open conversation"}</Link>
  </article>)}</div>;
}
