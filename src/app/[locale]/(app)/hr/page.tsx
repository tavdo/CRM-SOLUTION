import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Building2,
  Clock,
  Plane,
  Plus,
  Play,
  Square,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Badge, Button, Field, Input, Surface } from "@/components/ui";
import {
  createDepartmentAction,
  createLeaveRequestAction,
  toggleWorkClockAction,
  updateLeaveStatusAction,
} from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { isLocale } from "@/i18n/config";

export default async function HrAndWorktimePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";

  const [departments, members, workLogs, leaveRequests, myActiveLog] =
    await Promise.all([
      prisma.department.findMany({
        where: { companyId: ctx.company.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.membership.findMany({
        where: { companyId: ctx.company.id },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.workLog.findMany({
        where: { companyId: ctx.company.id, ...(can(ctx.role, "crm.all") ? {} : { userId: ctx.user.id }) },
        include: { user: { select: { name: true } } },
        orderBy: { clockInAt: "desc" },
        take: 15,
      }),
      prisma.leaveRequest.findMany({
        where: { companyId: ctx.company.id, ...(can(ctx.role, "crm.all") ? {} : { userId: ctx.user.id }) },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.workLog.findFirst({
        where: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          status: "WORKING",
          clockOutAt: null,
        },
      }),
    ]);

  return (
    <div style={{ display: "grid", gap: "1.35rem" }}>
      <div
        className="rise"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">
            {isKa
              ? "HR · კომპანიის სტრუქტურა, სამუშაო დრო და შვებულებები"
              : "HR & WORKTIME · ORG CHART, CLOCK-IN & LEAVES"}
          </span>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {isKa
              ? "თანამშრომლები, დეპარტამენტები და სამუშაო დრო"
              : "HR Structure & Worktime Tracker"}
          </h1>
        </div>

        <form action={toggleWorkClockAction} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant={myActiveLog ? "secondary" : "primary"}>
            {myActiveLog ? (
              <>
                <Square size={14} color="#10b981" fill="#10b981" />
                <span>
                  {isKa ? "სამუშაო დღის დასრულება (Clock Out)" : "Finish Workday (Clock Out)"}
                </span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>
                  {isKa ? "სამუშაო დღის დაწყება (Clock In)" : "Start Workday (Clock In)"}
                </span>
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Org Structure / Departments Grid */}
      <div>
        <h2 className="section-title" style={{ marginBottom: "0.75rem" }}>
          {isKa ? "კომპანიის დეპარტამენტები (Org Structure)" : "Company Departments & Structure"}
        </h2>
        <div
          style={{
            display: "grid",
            gap: "0.95rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
          }}
        >
          {departments.map((d) => (
            <Surface key={d.id} className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Building2 size={16} color="#10b981" />
                <Badge tone="ok">
                  <Users size={11} /> {d.memberCount}
                </Badge>
              </div>
              <strong style={{ fontSize: "1rem", marginTop: "0.65rem" }}>{d.name}</strong>
              <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                {isKa ? "ხელმძღვანელი" : "Head"}: {d.headName ?? "—"}
              </div>
            </Surface>
          ))}
        </div>
      </div>

      {/* Team Directory with Job Titles & Departments */}
      <Surface style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>{isKa ? "თანამშრომელი" : "Employee"}</th>
              <th>{isKa ? "თანამდებობა" : "Job Title"}</th>
              <th>{isKa ? "დეპარტამენტი" : "Department"}</th>
              <th>{isKa ? "როლი" : "Role"}</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong style={{ color: "#fff" }}>{m.user.name}</strong>
                </td>
                <td>{m.jobTitle ?? "Specialist"}</td>
                <td className="muted">{m.departmentName ?? "General"}</td>
                <td>
                  <Badge tone={m.role === "ADMIN" ? "ok" : "default"}>{m.role}</Badge>
                </td>
                <td className="muted">{m.user.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      {/* Two-Column: Worktime Attendance Logs + Leave Requests */}
      <div
        style={{
          display: "grid",
          gap: "1.15rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "start",
        }}
      >
        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
            <Clock size={16} color="#38bdf8" />
            <h2 className="section-title">
              {isKa ? "სამუშაო დროის აღრიცხვა (Time & Attendance)" : "Worktime Clock-In / Clock-Out Log"}
            </h2>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.1rem", display: "grid", gap: "0.5rem" }}>
            {workLogs.map((log) => (
              <li
                key={log.id}
                style={{
                  padding: "0.65rem 0.8rem",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div>
                  <strong style={{ color: "#fff", fontSize: "0.86rem" }}>{log.user.name}</strong>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    In: {formatDateTime(log.clockInAt, locale, ctx.company.timezone)}
                    {log.clockOutAt
                      ? ` · Out: ${formatDateTime(log.clockOutAt, locale, ctx.company.timezone)}`
                      : ""}
                  </div>
                </div>
                <Badge tone={log.status === "WORKING" ? "ok" : "default"}>
                  {log.status}
                </Badge>
              </li>
            ))}
          </ul>

          <form action={createDepartmentAction} style={{ display: "grid", gap: "0.6rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <div className="kicker">{isKa ? "ახალი დეპარტამენტის დამატება" : "Add Department"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "0.55rem" }}>
              <Input
                name="name"
                placeholder={isKa ? "დეპარტამენტის სახელი" : "Department name"}
                required
              />
              <Input
                name="headName"
                placeholder={isKa ? "ხელმძღვანელი" : "Head of dept"}
              />
            </div>
            <Button type="submit" variant="secondary">
              <Plus size={14} />
              <span>{isKa ? "დეპარტამენტის შექმნა" : "Create Department"}</span>
            </Button>
          </form>
        </Surface>

        <Surface style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
            <Plane size={16} color="#f59e0b" />
            <h2 className="section-title">
              {isKa ? "შვებულების და Day-Off მოთხოვნები" : "Vacation & Leave Requests"}
            </h2>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.1rem", display: "grid", gap: "0.5rem" }}>
            {leaveRequests.map((lr) => (
              <li
                key={lr.id}
                style={{
                  padding: "0.7rem 0.85rem",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong style={{ color: "#fff", fontSize: "0.86rem" }}>
                    {lr.user.name} · {lr.leaveType}
                  </strong>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {formatDate(lr.startDate, locale, ctx.company.timezone)} →{" "}
                    {formatDate(lr.endDate, locale, ctx.company.timezone)}
                    {lr.reason ? ` · ${lr.reason}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge tone={lr.status === "APPROVED" ? "ok" : "warn"}>
                    {lr.status}
                  </Badge>
                  {lr.status === "PENDING" ? (
                    <form action={updateLeaveStatusAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={lr.id} />
                      <input type="hidden" name="status" value="APPROVED" />
                      <Button
                        type="submit"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.74rem" }}
                      >
                        <CheckCircle2 size={12} />
                        <span>{isKa ? "დადასტურება" : "Approve"}</span>
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <form action={createLeaveRequestAction} style={{ display: "grid", gap: "0.6rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <div className="kicker">{isKa ? "შვებულების მოთხოვნა" : "Request Leave / Remote Day"}</div>
            <Field label={isKa ? "ტიპი" : "Type"} htmlFor="leaveType">
              <select id="leaveType" name="leaveType" className="select" defaultValue="VACATION">
                <option value="VACATION">{isKa ? "ანაზღაურებადი შვებულება" : "Paid Vacation"}</option>
                <option value="DAY_OFF">Day Off</option>
                <option value="REMOTE">{isKa ? "დისტანციური მუშაობა" : "Remote Work"}</option>
                <option value="SICK">{isKa ? "ბიულეტენი (Sick Leave)" : "Sick Leave"}</option>
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
              <Input name="startDate" type="date" required />
              <Input name="endDate" type="date" required />
            </div>
            <Input
              name="reason"
              placeholder={isKa ? "კომენტარი / მიზეზი" : "Reason / comment"}
            />
            <Button type="submit">
              <Plus size={14} />
              <span>{isKa ? "მოთხოვნის გაგზავნა" : "Submit Leave Request"}</span>
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
