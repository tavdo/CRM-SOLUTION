import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listProjects } from "@/lib/construction/core";
import { can } from "@/lib/permissions";
import { Badge, EmptyState, Surface } from "@/components/ui";

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const t = await getTranslations("construction");
  const projects = await listProjects(ctx);
  return <div className="construction-stack"><div className="construction-heading"><div><span className="kicker">{ctx.company.name}</span><h1 className="page-title">{t("projects")}</h1><p className="muted">{t("projectsIntro")}</p></div>{can(ctx.role, "construction.manage") ? <Link className="btn btn-primary" href={`/${locale}/projects/new`}>{t("newProject")}</Link> : null}</div>
    <div className="construction-projects">{projects.map((p) => <Link key={p.id} href={`/${locale}/projects/${p.id}`} className="construction-project-link"><Surface className="construction-panel"><div className="construction-row"><span className="kicker">{p.number}</span><Badge tone={p.status === "ACTIVE" ? "ok" : "default"}>{t(`status.${p.status}`)}</Badge></div><h2 className="section-title">{p.name}</h2><p>{p.customer.name}</p><p className="muted">{p.address}</p><div className="construction-row"><span>{t("work")}: {p._count.tasks}</span><span>{p.endDate?.toISOString().slice(0, 10) || "—"}</span></div></Surface></Link>)}</div>{projects.length ? null : <EmptyState>{t("emptyProjects")}</EmptyState>}
  </div>;
}
