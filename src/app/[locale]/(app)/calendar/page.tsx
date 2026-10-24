import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { MonthCalendar, type CalendarEvent } from "@/components/MonthCalendar";
import { Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
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

  const [tasks, deals, leaves] = await Promise.all([
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
    prisma.leaveRequest.findMany({
      where: {
        companyId: ctx.company.id,
        status: { in: ["APPROVED", "PENDING"] },
        ...(can(ctx.role, "crm.all") ? {} : { userId: ctx.user.id }),
      },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const events: CalendarEvent[] = [];

  for (const task of tasks) {
    if (!task.dueAt) continue;
    events.push({
      id: `task-${task.id}`,
      date: task.dueAt.toISOString(),
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

  for (const leave of leaves) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      events.push({
        id: `leave-${leave.id}-${d.toISOString().slice(0, 10)}`,
        date: d.toISOString(),
        title: `${leave.user.name} · ${leave.leaveType}`,
        href: `/${locale}/hr`,
        kind: "leave",
      });
    }
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
              ? "დავალებების ვადები, გარიგების დახურვის თარიღები და შვებულებები."
              : "Task due dates, expected deal close dates, and leave."}
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
