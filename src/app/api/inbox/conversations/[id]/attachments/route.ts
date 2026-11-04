import path from "node:path";
import { requireWorkspace } from "@/lib/auth/workspace";
import { conversationAccess } from "@/lib/services/inbox";
import { inboxError, limitedBytes, sameOrigin } from "@/lib/inbox/http";
import { storeMedia } from "@/lib/inbox/media";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request); const ctx = await requireWorkspace(); const id = (await params).id;
    const conversation = await conversationAccess(ctx, id);
    if (await prisma.inboxMessage.count({ where: { companyId: ctx.company.id, sentByUserId: ctx.user.id, status: "DRAFT", createdAt: { gt: new Date(Date.now() - 3600000) } } }) >= 20) throw new AppError("Upload limit reached", "RATE_LIMIT", 429);
    const bytes = await limitedBytes(request, 20 * 1024 * 1024);
    const provided = request.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
    const header = Buffer.from(bytes).subarray(0, 16);
    const mime = header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : header[0] === 255 && header[1] === 216 && header[2] === 255 ? "image/jpeg"
      : header.subarray(0, 3).toString() === "GIF" ? "image/gif"
      : header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WEBP" ? "image/webp"
      : header.subarray(0, 4).toString() === "OggS" ? "audio/ogg"
      : header.subarray(0, 3).toString() === "ID3" || (header[0] === 255 && (header[1] & 224) === 224) ? "audio/mpeg"
      : header.subarray(4, 8).toString() === "ftyp" ? provided.startsWith("audio/") ? "audio/mp4" : "video/mp4"
      : header.subarray(0, 5).toString() === "%PDF-" ? "application/pdf" : "application/octet-stream";
    const type = mime.startsWith("image/") ? "IMAGE" : mime.startsWith("audio/") ? "AUDIO" : mime.startsWith("video/") ? "VIDEO" : "FILE";
    const name = path.basename(decodeURIComponent(request.headers.get("x-file-name") || "attachment").replaceAll("\\", "/")).slice(0, 180);
    const storageKey = await storeMedia(ctx.company.id, bytes, mime);
    const result = await prisma.inboxMessage.create({ data: { companyId: ctx.company.id, channelId: conversation.channelId, conversationId: id, direction: "OUT", status: "DRAFT", type, sentByUserId: ctx.user.id,
      attachments: { create: { name, mimeType: mime, size: bytes.length, storageKey, status: "READY" } } }, include: { attachments: true } });
    return Response.json({ id: result.attachments[0].id, name, type });
  } catch (error) { return inboxError(error); }
}
