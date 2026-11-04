import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { recordScope } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { ContactTimeline } from "@/components/inbox/ContactTimeline";
export default async function LeadPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale); const ctx = await requireWorkspace();
  const lead = await prisma.lead.findFirst({ where: { id, ...recordScope(ctx) } }); if (!lead) notFound();
  const ka = locale === "ka";
  return <div className="construction-stack"><h1 className="page-title">{lead.title}</h1><section className="surface construction-panel"><h2>{lead.contactName}</h2><p>{lead.phone || lead.email || "—"}</p><span className="badge">{lead.status}</span>{lead.contactId && <p><Link href={`/${locale}/contacts/${lead.contactId}`}>{ka ? "კონტაქტი" : "Contact"} ↗</Link></p>}</section><section className="surface construction-panel"><nav className="construction-tabs"><a className="active" href="#messages">{ka ? "შეტყობინებები" : "Messages"}</a></nav><div id="messages"><ContactTimeline ctx={ctx} locale={locale} {...(lead.contactId ? { contactId: lead.contactId } : { leadId: id })} /></div></section></div>;
}
