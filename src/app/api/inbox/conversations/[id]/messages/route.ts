import { requireWorkspace } from "@/lib/auth/workspace";
import { queueReply } from "@/lib/services/inbox";
import { inboxError, limitedBody, sameOrigin } from "@/lib/inbox/http";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { sameOrigin(request); return Response.json(await queueReply(await requireWorkspace(), (await params).id, JSON.parse(await limitedBody(request, 16000))), { status: 202 }); }
  catch (error) { return inboxError(error); }
}
