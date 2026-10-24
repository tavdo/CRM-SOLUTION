import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Megaphone, MessageSquare, Pin, Send, Sparkles } from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Surface, Textarea } from "@/components/ui";
import { createFeedPostAction, sendChatMessageAction } from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { isLocale } from "@/i18n/config";

export default async function FeedAndChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ channel?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";
  const activeChannel = sp.channel || "general";

  const [posts, messages] = await Promise.all([
    prisma.feedPost.findMany({
      where: { companyId: ctx.company.id },
      include: { author: { select: { name: true } } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.chatMessage.findMany({
      where: { companyId: ctx.company.id, channel: activeChannel },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  const channels = [
    { key: "general", label: "#general" },
    { key: "sales", label: "#sales" },
    { key: "support", label: "#support" },
    { key: "management", label: "#management" },
  ];

  return (
    <div style={{ display: "grid", gap: "1.35rem" }}>
      <div className="rise">
        <span className="kicker">
          {isKa ? "კომუნიკაცია · კომპანიის სიახლეები და გუნდური ჩატი" : "TEAM COLLABORATION · ACTIVITY STREAM & CHAT"}
        </span>
        <h1 className="page-title" style={{ marginTop: 4 }}>
          {isKa ? "სიახლეების ლენტა და ჩატი (Bitrix24 Feed & Chat)" : "Company Feed & Team Chat"}
        </h1>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1.2rem",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 1fr)",
          alignItems: "start",
        }}
      >
        {/* Left: Company Feed / Announcements */}
        <div style={{ display: "grid", gap: "1rem" }}>
          <Surface style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
              <Megaphone size={16} color="#10b981" />
              <h2 className="section-title">
                {isKa ? "ახალი განცხადების / სიახლის გამოქვეყნება" : "Publish Announcement to Feed"}
              </h2>
            </div>
            <form action={createFeedPostAction} style={{ display: "grid", gap: "0.7rem" }}>
              <input type="hidden" name="locale" value={locale} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: "0.6rem" }}>
                <Input
                  name="title"
                  placeholder={isKa ? "სათაური..." : "Announcement title..."}
                  required
                />
                <select name="category" className="select" defaultValue="ANNOUNCEMENT">
                  <option value="ANNOUNCEMENT">{isKa ? "განცხადება" : "Announcement"}</option>
                  <option value="WIN">{isKa ? "მოგებული გარიგება" : "Deal Win"}</option>
                  <option value="UPDATE">{isKa ? "განახლება" : "Update"}</option>
                  <option value="HR">HR</option>
                </select>
              </div>
              <Textarea
                name="body"
                placeholder={isKa ? "დაწერეთ შეტყობინება მთელი კომპანიისთვის..." : "Share an update with the workspace..."}
                style={{ minHeight: 72 }}
                required
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
                  <input type="checkbox" name="pinned" />
                  <span>{isKa ? "მიმაგრება თავში (Pin)" : "Pin to top"}</span>
                </label>
                <Button type="submit">
                  <Sparkles size={14} />
                  <span>{isKa ? "გამოქვეყნება" : "Publish"}</span>
                </Button>
              </div>
            </form>
          </Surface>

          {posts.length === 0 ? (
            <Surface>
              <EmptyState>{isKa ? "სიახლეები ჯერ არ არის." : "No feed posts yet."}</EmptyState>
            </Surface>
          ) : (
            posts.map((post) => (
              <Surface key={post.id} className="surface-interactive" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {post.pinned ? (
                      <Badge tone="warn">
                        <Pin size={11} /> Pinned
                      </Badge>
                    ) : null}
                    <Badge tone={post.category === "WIN" ? "ok" : "default"}>
                      {post.category}
                    </Badge>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      {post.author.name}
                    </span>
                  </div>
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    {formatDateTime(post.createdAt, locale, ctx.company.timezone)}
                  </span>
                </div>
                <h3 style={{ margin: "0.6rem 0 0.35rem", fontSize: "1.05rem", color: "#fff" }}>
                  {post.title}
                </h3>
                <p style={{ margin: 0, color: "var(--ink-secondary)", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
                  {post.body}
                </p>
              </Surface>
            ))
          )}
        </div>

        {/* Right: Workspace Team Chat */}
        <Surface style={{ padding: "1.25rem", display: "grid", gap: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare size={16} color="#38bdf8" />
              <h2 className="section-title">
                {isKa ? "გუნდური ჩატი" : "Team Chat"}
              </h2>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {channels.map((ch) => (
                <Link
                  key={ch.key}
                  href={`/${locale}/feed?channel=${ch.key}`}
                  className={`btn ${activeChannel === ch.key ? "btn-primary" : "btn-secondary"}`}
                  style={{ padding: "0.28rem 0.6rem", fontSize: "0.74rem" }}
                >
                  {ch.label}
                </Link>
              ))}
            </div>
          </div>

          <div
            style={{
              minHeight: 320,
              maxHeight: 420,
              overflowY: "auto",
              display: "grid",
              gap: "0.55rem",
              alignContent: "start",
              padding: "0.75rem",
              borderRadius: 12,
              background: "rgba(5, 8, 13, 0.65)",
              border: "1px solid var(--line)",
            }}
          >
            {messages.length === 0 ? (
              <div className="muted" style={{ textAlign: "center", padding: "2rem 0" }}>
                {isKa ? "ამ არხში შეტყობინებები ჯერ არ არის." : "No messages in this channel yet."}
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.authorId === ctx.user.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: "0.6rem 0.8rem",
                      borderRadius: 11,
                      background: mine
                        ? "rgba(16, 185, 129, 0.14)"
                        : "rgba(255, 255, 255, 0.04)",
                      border: mine
                        ? "1px solid rgba(16, 185, 129, 0.35)"
                        : "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                      <strong style={{ color: mine ? "#6ee7b7" : "#38bdf8" }}>
                        {m.author.name}
                      </strong>
                      <span className="muted">
                        {formatDateTime(m.createdAt, locale, ctx.company.timezone)}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: "0.86rem", color: "#fff" }}>
                      {m.body}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form action={sendChatMessageAction} style={{ display: "flex", gap: "0.5rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="channel" value={activeChannel} />
            <Field label="" htmlFor="chatBody">
              <span className="sr-only">Message</span>
            </Field>
            <Input
              id="chatBody"
              name="body"
              placeholder={
                isKa
                  ? `მიწერეთ #${activeChannel} არხში...`
                  : `Message #${activeChannel}...`
              }
              required
            />
            <Button type="submit">
              <Send size={14} />
              <span>{isKa ? "გაგზავნა" : "Send"}</span>
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
