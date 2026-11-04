import type { Prisma } from "@prisma/client";
export async function nextAgent(db: Prisma.TransactionClient, companyId: string) {
  const agents = await db.inboxAgent.findMany({ where: { companyId, available: true }, orderBy: [{ lastAssignedAt: "asc" }, { id: "asc" }] });
  for (const agent of agents) {
    const member = await db.membership.findFirst({ where: { companyId, userId: agent.userId, role: { in: ["ADMIN", "MANAGER"] } } });
    if (!member) continue;
    const claimed = await db.inboxAgent.updateMany({ where: { id: agent.id, available: true, lastAssignedAt: agent.lastAssignedAt }, data: { lastAssignedAt: new Date() } });
    if (claimed.count) return agent.userId;
  }
  return null;
}
