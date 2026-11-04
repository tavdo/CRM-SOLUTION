import { requireWorkspace } from "@/lib/auth/workspace";
import { requireInbox } from "@/lib/inbox/access";
import { prisma } from "@/lib/db";
import { inboxError } from "@/lib/inbox/http";
import { phoneMatches, phoneOrNull } from "@/lib/inbox/matching";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspace(); requireInbox(ctx, true);
    const id = (await params).id;
    const contact = await prisma.contact.findFirst({ where: { id, companyId: ctx.company.id, archivedAt: null } });
    if (!contact?.phone) return Response.json([]);
    // Never expose other tenants' potential matches.
    const phone = phoneOrNull(contact.phone);
    if (!phone) return Response.json([]);
    const result = await phoneMatches(prisma, ctx.company.id, phone, 21);
    return Response.json(result.filter(row => row.id !== id));
  } catch (error) { return inboxError(error); }
}
