import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { MonthCalendar, type CalendarEvent } from "@/components/MonthCalendar";
import { Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/construction/access";
import { can } from "@/lib/permissions";
import { dateInTimezone } from "@/lib/dates";
import { isLocale } from "@/i18n/config";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";

  const ownerScope = can(ctx.role, "crm.all") ? {} : { ownerId: ctx.user.id };

  const [tasks, deals, projects] = await Promise.all([
    prisma.task.findMany({
      where: { companyId: ctx.company.id, dueAt: { not: null }, ...ownerScope },
      select: { id: true, title: true, dueAt: true },
    }),
    prisma.deal.findMany({
      where: {
        companyId: ctx.company.id,
        archivedAt: null,
        expectedCloseAt: { not: null },
        ...ownerScope,
      },
      select: { id: true, title: true, expectedCloseAt: true },
    }),
    prisma.constructionProject.findMany({ where: { AND: [projectScope(ctx), { endDate: { not: null }, status: { not: "ARCHIVED" } }] }, select: { id: true, name: true, endDate: true } }),
  ]);

  const events: CalendarEvent[] = [];

  for (const task of tasks) {
    if (!task.dueAt) continue;
    events.push({
      id: `task-${task.id}`,
      date: dateInTimezone(task.dueAt, ctx.company.timezone),
      title: task.title,
      href: `/${locale}/tasks/${task.id}`,
      kind: "task",
    });
  }

  for (const deal of deals) {
    if (!deal.expectedCloseAt) continue;
    events.push({
      id: `deal-${deal.id}`,
      date: deal.expectedCloseAt.toISOString(),
      title: deal.title,
      href: `/${locale}/deals/${deal.id}`,
      kind: "deal",
    });
  }

  for (const project of projects) {
    if (project.endDate) events.push({ id: `project-${project.id}`, date: project.endDate.toISOString(), title: project.name, href: `/${locale}/projects/${project.id}`, kind: "project" });
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">{ctx.company.name}</span>
          <h1 className="page-title" style={{ marginTop: 2 }}>
            {isKa ? "კალენდარი" : "Calendar"}
          </h1>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
            {isKa
              ? "სამუშაოების ვადები, შეთავაზებების თარიღები და ობიექტების ჩაბარება."
              : "Work deadlines, offer dates and project handovers."}
          </p>
        </div>
        <Link href={`/${locale}/tasks/new`} className="btn btn-primary">
          <Plus size={15} />
          <span>{isKa ? "ახალი დავალება" : "New task"}</span>
        </Link>
      </div>

      <Surface style={{ padding: "1.1rem" }}>
        <MonthCalendar locale={locale} events={events} />
      </Surface>
    </div>
  );
}
