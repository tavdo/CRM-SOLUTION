import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { projectAccess } from "@/lib/construction/access";
import { projectFinance } from "@/lib/construction/read";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { lineAmount } from "@/lib/construction/math";
import { PrintButton } from "./PrintButton";

export async function FinancialDocument({ locale, projectId, documentId, kind }: { locale: string; projectId: string; documentId: string; kind: "estimate" | "acceptance" }) {
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const p = await projectAccess(ctx, projectId, prisma, true);
  const f = await projectFinance(ctx, projectId);
  const t = await getTranslations("construction");
  const customer = await prisma.customer.findFirst({ where: { id: p.customerId, companyId: ctx.company.id }, select: { name: true, taxId: true } });
  const e = kind === "estimate" ? f.estimates.find((row) => row.id === documentId) : null;
  const a = kind === "acceptance" ? f.acceptances.find((row) => row.id === documentId) : null;
  if (!e && !a) notFound();
  const money = (v: number) => formatMoney(v, p.currency, locale);
  const rows = e ? e.lines.map((line) => ({ ...line, totalMinor: lineAmount(line.quantity, line.materialUnitMinor) + lineAmount(line.quantity, line.laborUnitMinor) + lineAmount(line.quantity, line.otherUnitMinor) + lineAmount(line.quantity, line.subcontractUnitMinor) + lineAmount(line.quantity, line.equipmentUnitMinor) })) : a!.lines;
  return <div className="construction-stack financial-document"><div className="construction-row print-hide"><Link href={`/${locale}/projects/${projectId}?tab=${e ? "estimates" : "finance"}`}>← {p.name}</Link><PrintButton label={t("print")} /></div><article className="construction-panel surface"><p className="kicker">{ctx.company.name} · {ctx.company.taxId || ""}</p><h1>{e ? `${t("estimates")} · ${t("version")} ${e.version}` : `${t("acceptance")} ${a!.number}`}</h1><p>{p.number} · {p.name} · {p.address}</p><p>{t("customerId")}: {customer?.name} {customer?.taxId}</p><p>{t("contractNumber")}: {p.contractNumber || "—"}</p><p>{t("statusLabel")}: {t(`status.${e?.status || a!.status}`)}</p><div className="construction-table"><table className="table"><thead><tr><th>{t("description")}</th><th>{t("quantity")}</th><th>{t("unit")}</th>{e ? <><th>{t("materialUnitMinor")}</th><th>{t("laborUnitMinor")}</th><th>{t("subcontractUnitMinor")}</th><th>{t("equipmentUnitMinor")}</th><th>{t("otherUnitMinor")}</th></> : <th>{t("unitPrice")}</th>}<th>{t("total")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.description}</td><td>{row.quantity}</td><td>{row.unit}</td>{"materialUnitMinor" in row ? <><td>{money(row.materialUnitMinor)}</td><td>{money(row.laborUnitMinor)}</td><td>{money(row.subcontractUnitMinor)}</td><td>{money(row.equipmentUnitMinor)}</td><td>{money(row.otherUnitMinor)}</td></> : <td>{money(row.unitMinor)}</td>}<td>{money(row.totalMinor)}</td></tr>)}</tbody></table></div><dl className="document-totals">{e ? <><div><dt>{t("extraMinor")}</dt><dd>{money(e.extraMinor)}</dd></div><div><dt>{t("plannedCost")}</dt><dd>{money(e.totals.cost)}</dd></div><div><dt>{t("markupBps")} ({e.markupBps / 100}%)</dt><dd>{money(e.totals.markup)}</dd></div></> : null}<div><dt>{t("netRevenue")}</dt><dd>{money(e?.totals.net ?? a!.netMinor)}</dd></div><div><dt>{t("vatBps")} ({(e?.vatBps ?? a!.vatBps) / 100}%)</dt><dd>{money(e?.totals.vat ?? a!.vatMinor)}</dd></div><div><dt>{t("total")}</dt><dd><strong>{money(e?.totals.total ?? a!.totalMinor)}</strong></dd></div></dl>{a ? <p className="muted">{t("acceptanceManualNote")}</p> : null}<div className="document-signatures"><p>{t("contractorSignature")} __________________</p><p>{t("customerSignature")} __________________</p></div></article></div>;
}
