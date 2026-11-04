import { verifyChallenge, receiveWebhook } from "@/lib/inbox/webhooks";
import { inboxError, limitedBody } from "@/lib/inbox/http";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ integrationId: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const challenge = await verifyChallenge((await params).integrationId, searchParams.get("hub.mode"), searchParams.get("hub.verify_token"), searchParams.get("hub.challenge"));
    return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  } catch (error) { return inboxError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ integrationId: string }> }) {
  try {
    await receiveWebhook((await params).integrationId, "META", await limitedBody(request), request.headers.get("x-hub-signature-256"));
    return Response.json({ ok: true });
  } catch (error) { return inboxError(error); }
}
