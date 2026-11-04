import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { saveDocument } from "@/lib/construction/documents";
import { isAppError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  let projectId = "";
  let locale = "ka";
  try {
    if (request.headers.get("origin") && new URL(request.headers.get("origin")!).host !== request.headers.get("host")) return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
    const ctx = await requireWorkspace();
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ code: "C_FILE" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 9 * 1024 * 1024) { await reader.cancel(); return NextResponse.json({ code: "C_FILE" }, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type") || "" } }).formData();
    projectId = String(form.get("projectId") || "");
    locale = form.get("locale") === "en" ? "en" : "ka";
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ code: "C_FILE" }, { status: 400 });
    await saveDocument(ctx, projectId, { category: String(form.get("category") || "PHOTO"), reportId: String(form.get("reportId") || "") }, file);
    return NextResponse.redirect(new URL(`/${locale}/projects/${encodeURIComponent(projectId)}?tab=documents&saved=1`, request.url), 303);
  } catch (error) {
    const code = isAppError(error) ? error.code : "C_FILE";
    if (projectId && /^[\w-]+$/.test(projectId)) return NextResponse.redirect(new URL(`/${locale}/projects/${projectId}?tab=documents&error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ code }, { status: isAppError(error) ? error.status : 400 });
  }
}
