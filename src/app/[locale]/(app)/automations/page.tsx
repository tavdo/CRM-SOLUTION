import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Bot, Plus, Zap, Power } from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Surface } from "@/components/ui";
import {
  createAutomationRuleAction,
  toggleAutomationRuleAction,
} from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { isLocale } from "@/i18n/config";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";

  const [rules, stages] = await Promise.all([
    prisma.automationRule.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pipelineStage.findMany({
      where: { companyId: ctx.company.id, archivedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]));

  return (
    <div style={{ display: "grid", gap: "1.35rem" }}>
      <div className="rise">
        <span className="kicker">
          {isKa
            ? "BITRIX24 ROBOTS · გაყიდვების მილის ავტომატიზაცია"
            : "BITRIX24 ROBOTS & TRIGGERS · PIPELINE AUTOMATION"}
        </span>
        <h1 className="page-title" style={{ marginTop: 4 }}>
          {isKa
            ? "ავტომატიზაციის წესები და რობოტები"
            : "Sales Pipeline Automation Rules"}
        </h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          {isKa
            ? "როდესაც გარიგება გადადის არჩეულ ეტაპზე, სისტემა ავტომატურად ქმნის დავალებას ან აქვეყნებს შეტყობინებას კომპანიის სიახლეებში."
            : "When a deal moves into a trigger stage on the Kanban board, these robots automatically create follow-up tasks or post announcements."}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1.15rem",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 1fr)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {rules.length === 0 ? (
            <Surface>
              <EmptyState>
                {isKa ? "ავტომატიზაციის წესები ჯერ არ არის." : "No automation rules configured."}
              </EmptyState>
            </Surface>
          ) : (
            rules.map((r) => (
              <Surface
                key={r.id}
                className="surface-interactive"
                style={{
                  padding: "1.2rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Badge tone={r.isActive ? "ok" : "default"}>
                      <Zap size={11} />
                      <span>Stage: {stageMap[r.triggerStageId] ?? r.triggerStageId}</span>
                    </Badge>
                    <Badge tone="warn">{r.actionType}</Badge>
                  </div>
                  <h2 style={{ margin: "0.55rem 0 0.25rem", fontSize: "1rem", color: "#fff" }}>
                    {r.name}
                  </h2>
                  <div className="muted" style={{ fontSize: "0.84rem" }}>
                    → {r.actionDetail}
                  </div>
                </div>

                <form action={toggleAutomationRuleAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={r.id} />
                  <Button
                    type="submit"
                    variant={r.isActive ? "secondary" : "primary"}
                    style={{ padding: "0.42rem 0.85rem", fontSize: "0.78rem" }}
                  >
                    <Power size={13} />
                    <span>
                      {r.isActive
                        ? isKa
                          ? "აქტიურია (გამორთვა)"
                          : "Active (Disable)"
                        : isKa
                          ? "ჩართვა"
                          : "Enable"}
                    </span>
                  </Button>
                </form>
              </Surface>
            ))
          )}
        </div>

        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
            <Bot size={16} color="#10b981" />
            <h2 className="section-title">
              {isKa ? "ახალი რობოტის დამატება" : "Create Stage Robot"}
            </h2>
          </div>
          <form action={createAutomationRuleAction} style={{ display: "grid", gap: "0.75rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <Field label={isKa ? "წესის სახელი" : "Rule Name"} htmlFor="name">
              <Input
                id="name"
                name="name"
                placeholder={isKa ? "მაგ: მოლაპარაკების ეტაპზე ინვოისის შექმნა" : "e.g. Negotiation → Prepare Contract"}
                required
              />
            </Field>
            <Field label={isKa ? "როდესაც გარიგება გადავა ეტაპზე:" : "When Deal Enters Stage:"} htmlFor="triggerStageId">
              <select id="triggerStageId" name="triggerStageId" className="select" required>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isKa ? "მოქმედება (Action)" : "Robot Action"} htmlFor="actionType">
              <select id="actionType" name="actionType" className="select" defaultValue="CREATE_TASK">
                <option value="CREATE_TASK">
                  {isKa ? "ავტომატური დავალების შექმნა" : "Auto-Create Task for Deal Owner"}
                </option>
                <option value="POST_FEED">
                  {isKa ? "სიახლეების ლენტაში გამოქვეყნება" : "Post Announcement to Company Feed"}
                </option>
                <option value="SEND_SMS">
                  {isKa
                    ? "SMS ლოგი (დემო — რეალური გაგზავნა არა)"
                    : "Log SMS (demo — not sent to carrier)"}
                </option>
              </select>
            </Field>
            <Field label={isKa ? "დავალების / შეტყობინების ტექსტი" : "Task Title / Message"} htmlFor="actionDetail">
              <Input
                id="actionDetail"
                name="actionDetail"
                placeholder={isKa ? "გაუგზავნეთ ქართული ინვოისი (დღგ 18%)" : "Send Georgian VAT invoice & contract"}
                required
              />
            </Field>
            <Button type="submit">
              <Plus size={14} />
              <span>{isKa ? "რობოტის შენახვა" : "Save Automation Rule"}</span>
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
