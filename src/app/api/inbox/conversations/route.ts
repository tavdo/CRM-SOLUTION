import { requireWorkspace } from "@/lib/auth/workspace";
import { listConversations } from "@/lib/services/inbox";
import { inboxError } from "@/lib/inbox/http";
export async function GET(request: Request) {
  try { return Response.json(await listConversations(await requireWorkspace(), Object.fromEntries(new URL(request.url).searchParams)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return inboxError(error); }
}
