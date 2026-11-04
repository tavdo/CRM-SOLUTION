import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { inboxBootstrap } from "@/lib/services/inbox";
import { Inbox } from "@/components/inbox/Inbox";
export default async function InboxPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ conversation?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const ctx = await requireWorkspace(); if (ctx.role === "EMPLOYEE") notFound();
  return <Inbox locale={locale} bootstrap={await inboxBootstrap(ctx)} initialConversation={(await searchParams).conversation} />;
}
