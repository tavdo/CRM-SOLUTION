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
  updateMemberRolesAction,
} from "@/app/actions/crm";
import { Alert, Badge, Button, Field, Input, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions";
import { isDatabaseRegistrationEnabled } from "@/lib/release-access";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ProviderStatus } from "@/components/ProviderStatus";
import { billingProvider, emailProvider, smsProvider } from "@/lib/providers";
import { isLocale } from "@/i18n/config";
import { redirect } from "next/navigation";
import styles from "./settings.module.css";

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
  const exportT = await getTranslations("workspaceExport");

  const [members, stages, fields, plans, audit] = await Promise.all([
    prisma.membership.findMany({
      where: { companyId: ctx.company.id },
      include: { user: { select: { id: true, name: true, email: true } } },
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
    can(ctx.role, "audit.view") ? prisma.auditEvent.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    }) : Promise.resolve([]),
  ]);

  const usage = can(ctx.role, "company.billing") ? await Promise.all([
    prisma.customer.count({ where: { companyId: ctx.company.id, archivedAt: null } }),
    prisma.deal.count({ where: { companyId: ctx.company.id, archivedAt: null } }),
  ]) : [0, 0];

  const isAdmin = can(ctx.role, "company.settings");

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <h1 className="page-title">{t("title")}</h1>
      <Surface style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
        <ProviderStatus provider={billingProvider()} locale={locale} />
        <ProviderStatus provider={emailProvider()} locale={locale} />
        <ProviderStatus provider={smsProvider()} locale={locale} />
      </Surface>

      {can(ctx.role, "company.export") ? (
        <Surface style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
          <h2 className="section-title">{exportT("title")}</h2>
          <p className="muted" style={{ margin: 0 }}>{exportT("body")}</p>
          <p className="muted" style={{ margin: 0 }}>{exportT("liveRead")}</p>
          <Alert tone="info">{exportT("notice")}</Alert>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a className="btn btn-primary" href="/api/workspace/export?format=json" download>{exportT("json")}</a>
            <a className="btn btn-secondary" href="/api/workspace/export?format=csv" download>{exportT("csv")}</a>
          </div>
        </Surface>
      ) : null}

      {isAdmin ? (
        <Surface className={styles.panel} style={{ padding: "1.2rem" }}>
          <h2 id="company" style={{ marginTop: 0, scrollMarginTop: 90 }}>{t("company")}</h2>
          <form action={updateCompanyAction} className={styles.companyForm}>
            <input type="hidden" name="locale" value={locale} />
            <div className={styles.companyRow}>
              <Field label={t("legalForm")} htmlFor="legalForm">
                <select id="legalForm" name="legalForm" className="select" defaultValue={ctx.company.legalForm || "შპს"}>
                  <option value="შპს">შპს (LLC)</option>
                  <option value="სს">სს (JSC)</option>
                  <option value="ი/მ">ი/მ (Sole Prop.)</option>
                </select>
              </Field>
              <Field label={t("companyName")} htmlFor="name">
                <Input id="name" name="name" defaultValue={ctx.company.name} required />
              </Field>
              <Field label={t("taxId")} htmlFor="taxId">
                <Input id="taxId" name="taxId" defaultValue={ctx.company.taxId ?? ""} />
              </Field>
            </div>
            <div className={styles.bankRow}>
              <Field label={t("bogIban")} htmlFor="bogIban">
                <Input id="bogIban" name="bogIban" defaultValue={ctx.company.bogIban ?? ""} />
              </Field>
              <Field label={t("tbcIban")} htmlFor="tbcIban">
                <Input id="tbcIban" name="tbcIban" defaultValue={ctx.company.tbcIban ?? ""} />
              </Field>
            </div>
            <div className={styles.companyRow}>
              <Field label={t("address")} htmlFor="address">
                <Input id="address" name="address" defaultValue={ctx.company.address ?? ""} />
              </Field>
              <Field label={t("phone")} htmlFor="phone">
                <Input id="phone" name="phone" defaultValue={ctx.company.phone ?? ""} />
              </Field>
              <Field label={t("vat")} htmlFor="isVatPayer">
                <select id="isVatPayer" name="isVatPayer" className="select" defaultValue={ctx.company.isVatPayer ? "true" : "false"}>
                  <option value="true">{t("vatYes")}</option>
                  <option value="false">{t("vatNo")}</option>
                </select>
              </Field>
            </div>
            <div className={styles.companyRow}>
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
            <div className={styles.actions}>
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </Surface>
      ) : null}

      <Surface className={styles.panel} style={{ padding: "1.2rem" }}>
        <h2 id="members" style={{ marginTop: 0, scrollMarginTop: 90 }}>{t("members")}</h2>
        <div className={styles.tableWrap}>
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("email")}</th>
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
                    <select
                      form="member-roles-form"
                      name={`role:${m.id}`}
                      aria-label={`${t("role")}: ${m.user.name}`}
                      className="select"
                      defaultValue={m.role}
                    >
                      <option value="ADMIN">{t("roles.ADMIN")}</option>
                      <option value="MANAGER">{t("roles.MANAGER")}</option>
                      <option value="EMPLOYEE">{t("roles.EMPLOYEE")}</option>
                    </select>
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
        </div>

        {isAdmin ? (
          <form id="member-roles-form" action={updateMemberRolesAction} style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit">{t("save")}</Button>
          </form>
        ) : null}

        {isAdmin && isDatabaseRegistrationEnabled() && (
          <p className="muted" role="status">
            {locale === "ka" ? "მოწვევების გაგზავნა ელფოსტით დროებით მიუწვდომელია." : "Email invitations are temporarily unavailable."}
          </p>
        )}
        {isAdmin && !isDatabaseRegistrationEnabled() ? (
          <form action={inviteMemberAction} className={`${styles.inlineForm} ${styles.inviteForm}`}>
            <h3 className={styles.fullRow} style={{ margin: 0 }}>{t("invite")}</h3>
            <input type="hidden" name="locale" value={locale} />
            <Input name="email" type="email" aria-label={t("email")} placeholder="email@company.com" required />
            <select name="role" aria-label={t("role")} className="select" defaultValue="EMPLOYEE">
              <option value="MANAGER">{t("roles.MANAGER")}</option>
              <option value="EMPLOYEE">{t("roles.EMPLOYEE")}</option>
              <option value="ADMIN">{t("roles.ADMIN")}</option>
            </select>
            <Button type="submit">{t("invite")}</Button>
            <p className={`muted ${styles.fullRow}`} style={{ margin: 0, fontSize: "0.85rem" }}>
              {t("invitationDelivery")}
            </p>
          </form>
        ) : null}
      </Surface>

      {can(ctx.role, "company.pipeline") ? (
        <Surface className={styles.panel} style={{ padding: "1.2rem" }}>
          <h2 id="pipeline" style={{ marginTop: 0, scrollMarginTop: 90 }}>{t("pipeline")}</h2>
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
          <form action={addStageAction} className={styles.inlineForm}>
            <input type="hidden" name="locale" value={locale} />
            <Input name="name" placeholder={t("stageName")} required />
            <Button type="submit">{t("addStage")}</Button>
          </form>
        </Surface>
      ) : null}

      {can(ctx.role, "company.customFields") ? (
        <Surface className={styles.panel} style={{ padding: "1.2rem" }}>
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
          <form action={addCustomFieldAction} className={`${styles.inlineForm} ${styles.customFieldForm}`}>
            <input type="hidden" name="locale" value={locale} />
            <Input name="name" aria-label={t("fieldName")} placeholder={t("fieldName")} required />
            <select name="fieldType" className="select" defaultValue="TEXT">
              <option value="TEXT">TEXT</option>
              <option value="NUMBER">NUMBER</option>
              <option value="DATE">DATE</option>
              <option value="SELECT">SELECT</option>
            </select>
            <Input name="options" className={`input ${styles.customFieldOptions}`} aria-label={t("fieldOptions")} placeholder={t("fieldOptions")} />
            <label className={styles.requiredField}>
              <input type="checkbox" name="required" /> {t("required")}
            </label>
            <Button type="submit">{t("addField")}</Button>
          </form>
        </Surface>
      ) : null}

      {can(ctx.role, "company.billing") ? (
        <Surface className={styles.panel} style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("subscription")}</h2>
          <p className="muted">{t("costScope")}</p>
          {ctx.subscription ? (
            <div style={{ marginTop: "1rem" }}>
              <dl className={styles.subscriptionFacts}>
                <div><dt>{t("plan")}</dt><dd>{ctx.subscription.plan.name}</dd></div>
                <div><dt>{t("status")}</dt><dd>{ctx.subscription.status}</dd></div>
                <div><dt>{t("trialEnds")}</dt><dd>{formatDate(ctx.subscription.trialEndsAt, locale, ctx.company.timezone)}</dd></div>
                <div><dt>{t("limits")}</dt><dd>{ctx.subscription.plan.maxUsers} {t("users")} / {ctx.subscription.plan.maxCustomers} {t("customers")} / {ctx.subscription.plan.maxDeals} {t("deals")}</dd></div>
                <div><dt>{t("usage")}</dt><dd>{members.length} {t("users")} / {usage[0]} {t("customers")} / {usage[1]} {t("deals")}</dd></div>
              </dl>
              <form action={changePlanAction} className={styles.inlineForm}>
                <input type="hidden" name="locale" value={locale} />
                <select name="planId" className="select" defaultValue={ctx.subscription.planId}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.priceMinor, p.currency, locale)} / {p.interval} ({t("examplePrice")})
                    </option>
                  ))}
                </select>
                <Button type="submit">{t("changePlan")}</Button>
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
