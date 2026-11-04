import { requireWorkspace } from "@/lib/auth/workspace";
import { requireInbox } from "@/lib/inbox/access";
import { inboxError, sameOrigin } from "@/lib/inbox/http";
import { prisma } from "@/lib/db";
export async function POST(request: Request) {
  try {
    sameOrigin(request); const ctx = await requireWorkspace(); requireInbox(ctx);
    const result = await prisma.$transaction(async db => {
      const row = await db.inboxConversation.findFirst({ where: { companyId: ctx.company.id, assignedUserId: null, status: "OPEN", channel: { status: "ACTIVE" } }, orderBy: { createdAt: "asc" } });
      if (!row) return { id: null };
      const claimed = await db.inboxConversation.updateMany({ where: { id: row.id, assignedUserId: null }, data: { assignedUserId: ctx.user.id } });
      return { id: claimed.count ? row.id : null };
    });
    return Response.json(result);
  } catch (error) { return inboxError(error); }
}
