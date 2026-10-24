import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Copy, ExternalLink, Globe } from "lucide-react";
import { Badge, Surface } from "@/components/ui";
import { WebformEmbedCopy } from "@/components/WebformEmbedCopy";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { isLocale } from "@/i18n/config";

export default async function ContactCenterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";

  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const formPath = `/${locale}/f/${ctx.company.slug}`;
  const formUrl = `${appUrl}${formPath}`;
  const embed = `<iframe src="${formUrl}" title="Lead form" width="100%" height="560" style="border:0;border-radius:12px;"></iframe>`;

  const recent = await prisma.lead.findMany({
    where: { companyId: ctx.company.id, source: "WEBSITE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { owner: { select: { name: true } } },
  });

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <span className="kicker">
          {isKa ? "ერთი რეალური არხი" : "ONE REAL INBOUND CHANNEL"}
        </span>
        <h1 className="page-title" style={{ marginTop: 4 }}>
          {isKa ? "ვებ-ფორმა → ლიდები" : "Web form → Leads"}
        </h1>
        <p className="muted" style={{ margin: "0.4rem 0 0", maxWidth: 640, fontSize: "0.9rem" }}>
          {isKa
            ? "Meta / WhatsApp / MyPhone ბეიჯები ამოღებულია — აქ არის რეალური საჯარო ფორმა, რომელიც ლიდს ქმნის. სხვა არხები მოგვიანებით."
            : "Fake Meta / WhatsApp / MyPhone badges removed. This is a real public form that creates leads. Other channels later."}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        }}
      >
        <Surface style={{ padding: "1.25rem", display: "grid", gap: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={16} color="#10b981" />
            <h2 className="section-title">{isKa ? "საჯარო ბმული" : "Public form link"}</h2>
            <Badge tone="ok">LIVE</Badge>
          </div>
          <code
            style={{
              display: "block",
              padding: "0.75rem 0.9rem",
              borderRadius: 10,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid var(--line)",
              fontSize: "0.8rem",
              wordBreak: "break-all",
              color: "#a7f3d0",
            }}
          >
            {formUrl}
          </code>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a href={formPath} target="_blank" rel="noreferrer" className="btn btn-primary">
              <ExternalLink size={14} />
              <span>{isKa ? "გახსნა" : "Open form"}</span>
            </a>
            <WebformEmbedCopy text={formUrl} label={isKa ? "ბმულის კოპირება" : "Copy link"} />
          </div>
        </Surface>

        <Surface style={{ padding: "1.25rem", display: "grid", gap: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Copy size={16} color="#38bdf8" />
            <h2 className="section-title">{isKa ? "Embed კოდი" : "Embed snippet"}</h2>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            {isKa
              ? "ჩასვით თქვენს საიტზე — iframe იხსნის იგივე ფორმას."
              : "Paste on your site — iframe loads the same form."}
          </p>
          <WebformEmbedCopy text={embed} label={isKa ? "კოდის კოპირება" : "Copy embed"} multiline />
        </Surface>
      </div>

      <Surface style={{ padding: "1.2rem" }}>
        <h2 className="section-title" style={{ marginBottom: "0.75rem" }}>
          {isKa ? "ბოლო ვებ-ლიდები" : "Recent web leads"}
        </h2>
        {recent.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            {isKa
              ? "ჯერ ცარიელია — გახსენით ფორმა და გაგზავნეთ ტესტი."
              : "None yet — open the form and submit a test inquiry."}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.45rem" }}>
            {recent.map((l) => (
              <li
                key={l.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div>
                  <strong style={{ color: "#fff", fontSize: "0.9rem" }}>{l.title}</strong>
                  <div className="muted" style={{ fontSize: "0.76rem" }}>
                    {l.contactName}
                    {l.email ? ` · ${l.email}` : ""}
                    {l.phone ? ` · ${l.phone}` : ""}
                  </div>
                </div>
                <Badge>{l.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
