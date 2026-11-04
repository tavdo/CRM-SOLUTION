import { requireWorkspace } from "@/lib/auth/workspace";
import { conversationAccess } from "@/lib/services/inbox";
import { prisma } from "@/lib/db";
import { readMedia } from "@/lib/inbox/media";
import { inboxError } from "@/lib/inbox/http";
import { AppError } from "@/lib/errors";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspace();
    const attachment = await prisma.inboxAttachment.findFirst({ where: { id: (await params).id, companyId: ctx.company.id, status: "READY" }, include: { message: true } });
    if (!attachment?.storageKey) throw new AppError("Not found", "NOT_FOUND", 404);
    await conversationAccess(ctx, attachment.message.conversationId);
    const bytes = await readMedia(ctx.company.id, attachment.storageKey);
    const inline = /^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|ogg|mp4)|video\/mp4)$/.test(attachment.mimeType || "");
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return inboxError(error); }
}
