import { requireWorkspace } from "@/lib/auth/workspace";
import { requireInbox } from "@/lib/inbox/access";
import { inboxError } from "@/lib/inbox/http";
import { prisma } from "@/lib/db";
export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspace(); requireInbox(ctx, true);
    const query = new URL(request.url).searchParams; const q = query.get("q")?.trim().slice(0, 100);
    if (!q) return Response.json([]);
    return Response.json(await prisma.contact.findMany({ where: { companyId: ctx.company.id, archivedAt: null, id: { not: query.get("exclude") || "" },
      OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] },
      select: { id: true, firstName: true, lastName: true, phone: true }, take: 20 }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return inboxError(error); }
}
