"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { isAppError } from "@/lib/errors";
import * as core from "@/lib/construction/core";
import * as ledger from "@/lib/construction/ledger";

export type ConstructionActionState = { error?: string };
export async function constructionAction(previous: ConstructionActionState, form: FormData): Promise<ConstructionActionState> {
  void previous;
  const data = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).normalize("NFC").trim()]));
  const locale = data.locale === "en" ? "en" : "ka";
  let destination = `/${locale}/projects/${encodeURIComponent(data.projectId || "")}`;
  try {
    const ctx = await requireWorkspace();
    const projectId = data.projectId;
    let tab = "overview";
    switch (data.operation) {
      case "project.create": destination = `/${locale}/projects/${(await core.createProject(ctx, data)).id}`; break;
      case "project.fromDeal": destination = `/${locale}/projects/${(await core.projectFromDeal(ctx, data.dealId)).id}`; break;
      case "project.update": await core.updateProject(ctx, projectId, data); break;
      case "estimate.create": await core.createEstimate(ctx, projectId, data); tab = "estimates"; break;
      case "estimate.line": await core.addEstimateLine(ctx, projectId, data); tab = "estimates"; break;
      case "estimate.approve": await core.approveEstimate(ctx, projectId, data.estimateId); tab = "estimates"; break;
      case "estimate.edit": await core.editEstimate(ctx, projectId, data); tab = "estimates"; break;
      case "estimate.removeLine": await core.removeEstimateLine(ctx, projectId, data); tab = "estimates"; break;
      case "cost.record": await core.recordCost(ctx, projectId, data); tab = "budget"; break;
      case "change.create": await core.addChange(ctx, projectId, data); tab = "budget"; break;
      case "change.approve": await core.approveChange(ctx, projectId, data.changeId); tab = "budget"; break;
      case "work.create": await core.createWork(ctx, projectId, data); tab = "work"; break;
      case "report.create": await core.addReport(ctx, projectId, data); tab = "work"; break;
      case "report.resolve": await core.resolveReport(ctx, projectId, data.reportId); tab = "work"; break;
      case "partner.create": await core.createPartner(ctx, data); destination = `/${locale}/partners`; tab = "materials"; revalidatePath(destination); break;
      case "material.request": await ledger.requestMaterial(ctx, projectId, data); tab = "materials"; break;
      case "quote.create": await ledger.addSupplyQuote(ctx, projectId, data); tab = "materials"; break;
      case "purchase.order": await ledger.orderQuote(ctx, projectId, data.quoteId); tab = "materials"; break;
      case "purchase.receive": await ledger.receiveOrder(ctx, projectId, data); tab = "materials"; break;
      case "stock.move": await ledger.moveStock(ctx, projectId, data); tab = "materials"; break;
      case "subcontract.create": await ledger.createSubcontract(ctx, projectId, data); tab = "subcontracts"; break;
      case "subcontract.progress": await ledger.confirmSubcontractProgress(ctx, projectId, data); tab = "subcontracts"; break;
      case "acceptance.create": {
        const descriptions = form.getAll("lineDescription");
        if (descriptions.length > 200) return { error: "C_VALIDATION" };
        const lines = descriptions.map((description, i) => ({ description: String(description), unit: String(form.getAll("lineUnit")[i] || ""), quantity: String(form.getAll("lineQuantity")[i] || ""), unitMinor: String(form.getAll("linePrice")[i] || "") }));
        await ledger.createAcceptance(ctx, projectId, { ...data, lines }); tab = "finance"; break;
      }
      case "acceptance.confirm": await ledger.confirmAcceptance(ctx, projectId, data.acceptanceId); tab = "finance"; break;
      case "acceptance.invoice": await ledger.invoiceAcceptance(ctx, projectId, data.acceptanceId); tab = "finance"; break;
      case "payment.record": await ledger.recordPayment(ctx, projectId, data); tab = "finance"; break;
      default: return { error: "C_VALIDATION" };
    }
    revalidatePath(`/${locale}/projects`, "layout");
    revalidatePath(`/${locale}/dashboard`);
    revalidatePath(`/${locale}/tasks`);
    revalidatePath(`/${locale}/invoices`);
    destination += `?tab=${tab}&saved=1`;
  } catch (error) {
    const coded = error as { code?: string; status?: number };
    return { error: isAppError(error) ? error.code : coded.status === 403 ? "FORBIDDEN" : coded.code === "P2002" ? "C_CONFLICT" : "C_ERROR" };
  }
  redirect(destination);
}
