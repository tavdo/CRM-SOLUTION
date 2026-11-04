import { requireWorkspace } from "@/lib/auth/workspace";
import { getConversation, updateConversation, markRead } from "@/lib/services/inbox";
import { inboxError, limitedBody, sameOrigin } from "@/lib/inbox/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try { return Response.json(await getConversation(await requireWorkspace(), (await params).id, new URL(request.url).searchParams.get("before") || undefined), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return inboxError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try { sameOrigin(request); await updateConversation(await requireWorkspace(), (await params).id, JSON.parse(await limitedBody(request, 16000))); return Response.json({ ok: true }); }
  catch (error) { return inboxError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { sameOrigin(request); await markRead(await requireWorkspace(), (await params).id); return Response.json({ ok: true }); }
  catch (error) { return inboxError(error); }
}
