import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  addCustomFieldAction,
  addStageAction,
  archiveCustomFieldAction,
  changePlanAction,
  deleteStageAction,
  inviteMemberAction,
  removeMemberAction,
  updateCompanyAction,
  updateMemberRoleAction,
} from "@/app/actions/crm";
import { Alert, Badge, Button, Field, Input, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("settings");

  const [members, stages, fields, plans, audit] = await Promise.all([
    prisma.membership.findMany({
      where: { companyId: ctx.company.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pipelineStage.findMany({
      where: { companyId: ctx.company.id, archivedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.customFieldDefinition.findMany({
      where: { companyId: ctx.company.id, archivedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.auditEvent.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const isAdmin = can(ctx.role, "company.settings");

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <h1 className="page-title">{t("title")}</h1>

      {isAdmin ? (
        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("company")}</h2>
          <form action={updateCompanyAction} style={{ display: "grid", gap: "0.85rem", maxWidth: 680 }}>
            <input type="hidden" name="locale" value={locale} />
            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 160px", gap: "0.65rem" }}>
              <Field label="Legal Form / ფორმა" htmlFor="legalForm">
                <select id="legalForm" name="legalForm" className="select" defaultValue={ctx.company.legalForm || "შპს"}>
                  <option value="შპს">შპს (LLC)</option>
                  <option value="სს">სს (JSC)</option>
                  <option value="ი/მ">ი/მ (Sole Prop.)</option>
                </select>
              </Field>
              <Field label="Company Name / სახელი" htmlFor="name">
                <Input id="name" name="name" defaultValue={ctx.company.name} required />
              </Field>
              <Field label="ს/კ (9-digit Tax ID)" htmlFor="taxId">
                <Input id="taxId" name="taxId" defaultValue={ctx.company.taxId ?? "405318921"} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
              <Field label="Bank of Georgia IBAN (BAGAGE22)" htmlFor="bogIban">
                <Input id="bogIban" name="bogIban" defaultValue={ctx.company.bogIban ?? "GE29BG0000000101904917"} />
              </Field>
              <Field label="TBC Bank IBAN (TBCBGE22)" htmlFor="tbcIban">
                <Input id="tbcIban" name="tbcIban" defaultValue={ctx.company.tbcIban ?? "GE83TB7000000365123456"} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: "0.65rem" }}>
              <Field label="Address / მისამართი" htmlFor="address">
                <Input id="address" name="address" defaultValue={ctx.company.address ?? ""} />
              </Field>
              <Field label="Phone / ტელეფონი" htmlFor="phone">
                <Input id="phone" name="phone" defaultValue={ctx.company.phone ?? ""} />
              </Field>
              <Field label="VAT / დღგ (18%)" htmlFor="isVatPayer">
                <select id="isVatPayer" name="isVatPayer" className="select" defaultValue={ctx.company.isVatPayer ? "true" : "false"}>
                  <option value="true">დღგ-ს გადამხდელი (18%)</option>
                  <option value="false">დღგ-ს გარეშე (0%)</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: "0.65rem" }}>
              <Field label={t("timezone")} htmlFor="timezone">
                <Input id="timezone" name="timezone" defaultValue={ctx.company.timezone} />
              </Field>
              <Field label={t("defaultLocale")} htmlFor="defaultLocale">
                <select id="defaultLocale" name="defaultLocale" className="select" defaultValue={ctx.company.defaultLocale}>
                  <option value="en">English</option>
                  <option value="ka">ქართული</option>
                </select>
              </Field>
              <Field label={t("currency")} htmlFor="currency">
                <Input id="currency" name="currency" defaultValue={ctx.company.currency} />
              </Field>
            </div>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Surface>
      ) : null}

      <Surface style={{ padding: "1.2rem" }}>
        <h2 style={{ marginTop: 0 }}>{t("members")}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>{t("role")}</th>
              {isAdmin ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.user.name}</td>
                <td>{m.user.email}</td>
                <td>
                  {isAdmin ? (
                    <form action={updateMemberRoleAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select name="role" className="select" defaultValue={m.role}>
                        <option value="ADMIN">{t("roles.ADMIN")}</option>
                        <option value="MANAGER">{t("roles.MANAGER")}</option>
                        <option value="EMPLOYEE">{t("roles.EMPLOYEE")}</option>
                      </select>
                      <Button type="submit" variant="secondary">
                        {t("save")}
                      </Button>
                    </form>
                  ) : (
                    t(`roles.${m.role}`)
                  )}
                </td>
                {isAdmin ? (
                  <td>
                    {m.userId !== ctx.user.id ? (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="membershipId" value={m.id} />
                        <Button type="submit" variant="danger">
                          {t("remove")}
                        </Button>
                      </form>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>

        {isAdmin ? (
          <form action={inviteMemberAction} style={{ display: "grid", gap: "0.75rem", marginTop: "1rem", maxWidth: 480 }}>
            <h3 style={{ margin: 0 }}>{t("invite")}</h3>
            <input type="hidden" name="locale" value={locale} />
            <Input name="email" type="email" placeholder="email@company.com" required />
            <select name="role" className="select" defaultValue="EMPLOYEE">
              <option value="MANAGER">{t("roles.MANAGER")}</option>
              <option value="EMPLOYEE">{t("roles.EMPLOYEE")}</option>
              <option value="ADMIN">{t("roles.ADMIN")}</option>
            </select>
            <Button type="submit">{t("invite")}</Button>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Invitation links are logged to the server console when EMAIL_TRANSPORT=console.
            </p>
          </form>
        ) : null}
      </Surface>

      {can(ctx.role, "company.pipeline") ? (
        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("pipeline")}</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {stages.map((s) => (
              <li key={s.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid var(--line)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{s.name}</strong>
                {s.isWon ? <Badge tone="ok">WON</Badge> : null}
                {s.isLost ? <Badge tone="danger">LOST</Badge> : null}
                <form action={deleteStageAction} style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="stageId" value={s.id} />
                  <select name="moveToStageId" className="select" required>
                    <option value="">{t("stageName")} →</option>
                    {stages
                      .filter((x) => x.id !== s.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                  <Button type="submit" variant="danger">
                    Delete
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addStageAction} style={{ display: "flex", gap: 8, marginTop: "1rem", flexWrap: "wrap" }}>
            <input type="hidden" name="locale" value={locale} />
            <Input name="name" placeholder={t("stageName")} required />
            <Button type="submit">{t("addStage")}</Button>
          </form>
        </Surface>
      ) : null}

      {can(ctx.role, "company.customFields") ? (
        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("fields")}</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {fields.map((f) => (
              <li key={f.id} style={{ padding: "0.45rem 0", display: "flex", gap: 8, alignItems: "center" }}>
                <span>
                  {f.name} <span className="muted">({f.fieldType})</span>
                </span>
                <form action={archiveCustomFieldAction} style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="fieldId" value={f.id} />
                  <Button type="submit" variant="danger">
                    Archive
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addCustomFieldAction} style={{ display: "grid", gap: "0.75rem", marginTop: "1rem", maxWidth: 480 }}>
            <input type="hidden" name="locale" value={locale} />
            <Input name="name" placeholder={t("fieldName")} required />
            <select name="fieldType" className="select" defaultValue="TEXT">
              <option value="TEXT">TEXT</option>
              <option value="NUMBER">NUMBER</option>
              <option value="DATE">DATE</option>
              <option value="SELECT">SELECT</option>
            </select>
            <Input name="options" placeholder={t("fieldOptions")} />
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="required" /> Required
            </label>
            <Button type="submit">{t("addField")}</Button>
          </form>
        </Surface>
      ) : null}

      {can(ctx.role, "company.billing") ? (
        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("subscription")}</h2>
          <Alert tone="info">{t("billingNote")}</Alert>
          <Badge tone="warn">{t("simulated")}</Badge>
          {ctx.subscription ? (
            <div style={{ marginTop: "1rem" }}>
              <p>
                <strong>{t("plan")}:</strong> {ctx.subscription.plan.name}
                <br />
                <strong>{t("status")}:</strong> {ctx.subscription.status}
                <br />
                <strong>{t("trialEnds")}:</strong>{" "}
                {formatDate(ctx.subscription.trialEndsAt, locale, ctx.company.timezone)}
                <br />
                <strong>{t("limits")}:</strong> {ctx.subscription.plan.maxUsers} users /{" "}
                {ctx.subscription.plan.maxCustomers} customers / {ctx.subscription.plan.maxDeals} deals
              </p>
              <form action={changePlanAction} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
                <input type="hidden" name="locale" value={locale} />
                <select name="planId" className="select" defaultValue={ctx.subscription.planId}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.priceMinor, p.currency, locale)} / {p.interval} (placeholder)
                    </option>
                  ))}
                </select>
                <Button type="submit">Change plan (local only)</Button>
              </form>
            </div>
          ) : null}
        </Surface>
      ) : null}

      {can(ctx.role, "audit.view") ? (
        <Surface style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("audit")}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {audit.map((a) => (
              <li key={a.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--line)" }}>
                <strong>{a.action}</strong> · {a.entityType}
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {a.actor?.name ?? "system"} · {formatDate(a.createdAt, locale, ctx.company.timezone)}
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </div>
  );
}
