import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/construction/ActionForm";
import { SiteField, SiteSelect } from "@/components/construction/Fields";
import { Panel } from "@/components/construction/ProjectPanels";

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  assertCan(ctx.role, "construction.manage");
  const t = await getTranslations("construction");
  const [customers, members, deals] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: ctx.company.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.membership.findMany({ where: { companyId: ctx.company.id }, select: { userId: true, user: { select: { name: true } } } }),
    prisma.deal.findMany({ where: { companyId: ctx.company.id, archivedAt: null, status: "WON", customerId: { not: null }, constructionProject: null }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  const people = members.map((m) => ({ id: m.userId, label: m.user.name }));
  return <div className="construction-stack"><Link href={`/${locale}/projects`}>← {t("projects")}</Link><h1 className="page-title">{t("newProject")}</h1>
    <Panel title={t("fromDeal")}><p className="muted">{t("fromDealNote")}</p><ActionForm operation="project.fromDeal" locale={locale} label={t("fromDeal")}><SiteSelect name="dealId" label={t("deal")} options={deals.map((d) => ({ id: d.id, label: d.title }))} /></ActionForm></Panel>
    <Panel title={t("projectDetails")}><ActionForm operation="project.create" locale={locale} label={t("newProject")}><div className="construction-grid"><SiteField name="number" label={t("number")} /><SiteField name="name" label={t("name")} /><SiteSelect name="customerId" label={t("customerId")} options={customers.map((c) => ({ id: c.id, label: c.name }))} /><SiteField name="address" label={t("address")} /><SiteField name="workType" label={t("workType")} /><SiteSelect name="managerId" label={t("managerId")} value={ctx.user.id} options={people} /><SiteSelect name="siteLeadId" label={t("siteLeadId")} options={people} optional /><SiteField name="startDate" label={t("startDate")} type="date" required={false} /><SiteField name="endDate" label={t("endDate")} type="date" required={false} /><SiteField name="contractNumber" label={t("contractNumber")} required={false} /><SiteField name="description" label={t("description")} required={false} /></div></ActionForm><Link className="btn btn-secondary" href={`/${locale}/customers/new`}>{t("newCustomer")}</Link></Panel>
  </div>;
}
