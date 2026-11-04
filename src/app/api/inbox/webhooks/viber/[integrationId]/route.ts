import { receiveWebhook } from "@/lib/inbox/webhooks";
import { viber } from "@/lib/inbox/adapters/viber";
import { inboxError, limitedBody } from "@/lib/inbox/http";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ integrationId: string }> }) {
  try {
    await receiveWebhook((await params).integrationId, "VIBER", await limitedBody(request), request.headers.get("x-viber-content-signature"), viber.verifyWebhook);
    return Response.json({ ok: true });
  } catch (error) { return inboxError(error); }
}
