import type { PrismaClient } from "@prisma/client";
import { estimateTotals } from "./math";

/** Additive fixtures only in the two known demo tenants. Never overwrite existing records. */
export async function ensureConstructionDemo(db: PrismaClient) {
  for (const prefix of ["alpha", "beta"]) {
    const company = await db.company.findFirst({ where: { id: `company_${prefix}`, slug: `demo-${prefix}` } });
    if (!company) continue;
    const memberships = await db.membership.findMany({ where: { companyId: company.id }, include: { user: true } });
    const manager = memberships.find((m) => m.role === "MANAGER") ?? memberships.find((m) => m.role === "ADMIN");
    const worker = memberships.find((m) => m.role === "EMPLOYEE") ?? manager;
    if (!manager || !worker) continue;
    const names = prefix === "beta" ? ["სახლის მშენებლობა", "ოფისის რემონტი", "ფასადის სამუშაოები", "ელექტრომონტაჟი"] : ["House construction", "Office renovation", "Facade works", "Electrical installation"];
    for (const [index, name] of names.entries()) {
      const projectId = `contractor_demo_${prefix}_${index}`;
      if (await db.constructionProject.findUnique({ where: { id: projectId } })) continue;
      // A transaction prevents partially populated demos. An existing project is never rewritten.
      await db.$transaction(async (tx) => {
        const customer = await tx.customer.upsert({ where: { id: `contractor_client_${prefix}_${index}` }, update: {}, create: { id: `contractor_client_${prefix}_${index}`, companyId: company.id, ownerId: manager.userId, name: `${name} · DEMO`, address: "თბილისი / Tbilisi" } });
        const project = await tx.constructionProject.create({ data: { id: projectId, companyId: company.id, number: `DEMO-${index + 1}`, name, customerId: customer.id, address: "თბილისი / Tbilisi · DEMO", workType: name, description: "DEMO · სამშენებლო სასწავლო მაგალითი / Construction sample", managerId: manager.userId, siteLeadId: worker.userId, currency: company.currency, status: index === 3 ? "PLANNING" : "ACTIVE", stage: index === 3 ? "ESTIMATE" : "EXECUTION", startDate: new Date("2026-11-01T00:00:00Z"), endDate: new Date("2026-12-20T00:00:00Z") } });
        const line = { description: name, unit: index === 3 ? "m" : "m²", quantity: "100.5", materialUnitMinor: 1500, laborUnitMinor: 1000, otherUnitMinor: 100 };
        const totals = estimateTotals([line], 10000, 1500, 0);
        await tx.constructionEstimate.create({ data: { companyId: company.id, projectId, version: 1, status: "APPROVED", operationKey: `demo-estimate-${projectId}`, createdById: manager.userId, approvedAt: new Date(), markupBps: 1500, vatBps: 0, extraMinor: 10000, lines: { create: { ...line, companyId: company.id } } } });
        const task = await tx.task.create({ data: { companyId: company.id, projectId, title: name, phase: prefix === "beta" ? "ძირითადი სამუშაოები" : "Main work", ownerId: worker.userId, creatorId: manager.userId, customerId: customer.id, plannedQuantity: "100.5", workUnit: line.unit, dueAt: project.endDate } });
        if (index < 3) await tx.siteReport.create({ data: { companyId: company.id, projectId, taskId: task.id, authorId: worker.userId, kind: "PROGRESS", completedQuantity: "25.125", body: "DEMO · დღიური შესრულება / Daily progress", date: new Date("2026-11-03T00:00:00Z"), operationKey: `demo-report-${projectId}` } });
        await tx.projectCost.create({ data: { companyId: company.id, projectId, category: "LABOR", description: "DEMO · შრომის ხარჯი / Labor cost", amountMinor: index === 2 ? totals.cost + 10000 : 50000, date: new Date("2026-11-03T00:00:00Z"), operationKey: `demo-cost-${projectId}`, createdById: manager.userId } });
        await tx.projectPayment.create({ data: { companyId: company.id, projectId, direction: "IN", kind: "ADVANCE", amountMinor: 100000, description: "DEMO · ხელით აღრიცხული ავანსი / Manually recorded advance", date: new Date("2026-11-02T00:00:00Z"), operationKey: `demo-payment-${projectId}`, recordedById: manager.userId } });
      });
    }
  }
}
