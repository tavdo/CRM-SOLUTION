import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listPartners } from "@/lib/construction/read";
import { Panel } from "@/components/construction/ProjectPanels";
import { SiteField, SiteSelect } from "@/components/construction/Fields";
import { ActionForm } from "@/components/construction/ActionForm";
import { Badge } from "@/components/ui";

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("construction");
  const partners = await listPartners(await requireWorkspace());
  return <div className="construction-stack"><Link href={`/${locale}/projects`}>← {t("projects")}</Link><h1 className="page-title">{t("partners")}</h1><Panel title={t("newPartner")}><ActionForm operation="partner.create" locale={locale} label={t("newPartner")}><div className="construction-grid"><SiteField name="name" label={t("name")} /><SiteSelect name="kind" label={t("partnerKind")} options={["SUPPLIER", "SUBCONTRACTOR", "BOTH"].map((id) => ({ id, label: t(`status.${id}`) }))} /><SiteField name="specialty" label={t("specialty")} required={false} /><SiteField name="phone" label={t("phone")} type="tel" required={false} /><SiteField name="email" label={t("email")} type="email" required={false} /></div></ActionForm></Panel><Panel title={t("partners")}>{partners.map((p) => <div className="construction-item" key={p.id}><strong>{p.name}</strong> <Badge>{t(`status.${p.kind}`)}</Badge><p>{p.specialty}</p><p className="muted">{p.phone} · {p.email}</p></div>)}</Panel></div>;
}
