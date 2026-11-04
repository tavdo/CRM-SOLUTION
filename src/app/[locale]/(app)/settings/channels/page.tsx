import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { inboxBootstrap } from "@/lib/services/inbox";
import { prisma } from "@/lib/db";
import { ChannelSettings } from "@/components/inbox/ChannelSettings";
export default async function InboxSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const ctx = await requireWorkspace(); if (ctx.role !== "ADMIN") notFound();
  const [bootstrap, integrations, failedEvents, pendingCount] = await Promise.all([inboxBootstrap(ctx),
    prisma.inboxIntegration.findMany({ where: { companyId: ctx.company.id }, select: { id: true, name: true, provider: true } }),
    prisma.inboxWebhookEvent.findMany({ where: { companyId: ctx.company.id, status: "FAILED" }, select: { id: true, attempts: true, createdAt: true }, take: 20 }),
    prisma.inboxOutboxEvent.count({ where: { companyId: ctx.company.id, dispatchedAt: null } })]);
  return <ChannelSettings locale={locale} bootstrap={bootstrap} integrations={integrations} failedEvents={failedEvents} pendingCount={pendingCount}
    appUrl={(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")} keyConfigured={Buffer.from(process.env.INBOX_ENCRYPTION_KEY || "", "base64").length === 32} />;
}
