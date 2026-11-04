import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { recordScope } from "@/lib/scope";
import { inboxScope } from "@/lib/inbox/access";
import { prisma } from "@/lib/db";
import { ContactTimeline } from "@/components/inbox/ContactTimeline";
import { MergeContacts } from "@/components/inbox/MergeContacts";
export default async function ContactPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale); const ctx = await requireWorkspace();
  // A manager can open a contact linked to their conversation without gaining other owners' history.
  const linked = ctx.role !== "EMPLOYEE" && await prisma.inboxConversation.findFirst({ where: { AND: [inboxScope(ctx), { contactId: id }] } });
  const contact = await prisma.contact.findFirst({ where: { id, companyId: ctx.company.id, ...(!linked ? recordScope(ctx) : {}) } });
  if (!contact) notFound();
  const ka = locale === "ka";
  return <div className="construction-stack"><h1 className="page-title">{contact.firstName} {contact.lastName}</h1><section className="surface construction-panel"><p>{contact.phone || "—"}</p><p>{contact.email || "—"}</p>{contact.customerId && <Link href={`/${locale}/customers/${contact.customerId}`}>{ka ? "კლიენტის ბარათი" : "Client card"} ↗</Link>}</section>
    <section className="surface construction-panel"><nav className="construction-tabs"><a className="active" href="#messages">{ka ? "შეტყობინებები" : "Messages"}</a></nav><div id="messages"><ContactTimeline ctx={ctx} locale={locale} contactId={id} /></div>{ctx.role === "ADMIN" && !contact.archivedAt && <MergeContacts contactId={id} locale={locale} />}</section></div>;
}
