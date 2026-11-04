import { prisma } from "@/lib/db";
import { readMedia, verifyShare } from "@/lib/inbox/media";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const query = new URL(request.url).searchParams;
    if (!verifyShare(id, Number(query.get("expires")), query.get("token") || "")) return new Response(null, { status: 404 });
    const attachment = await prisma.inboxAttachment.findFirst({ where: { id, status: "READY", message: { direction: "OUT" } } });
    if (!attachment?.storageKey) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(await readMedia(attachment.companyId, attachment.storageKey)), { headers: { "Content-Type": attachment.mimeType || "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
  } catch { return new Response(null, { status: 404 }); }
}
