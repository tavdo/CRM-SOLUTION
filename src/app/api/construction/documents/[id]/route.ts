import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { readDocument } from "@/lib/construction/documents";
import { isAppError } from "@/lib/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspace();
    const { document, bytes } = await readDocument(ctx, (await params).id);
    return new Response(bytes, { headers: { "Content-Type": document.mimeType, "Content-Disposition": `${document.mimeType.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(document.name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: isAppError(error) ? error.status : 404 });
  }
}
