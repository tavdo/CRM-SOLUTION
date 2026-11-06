import { NextRequest, NextResponse } from "next/server";
import { createInboundLead } from "@/lib/services/leads";
import { ensureDbInitialized } from "@/lib/db-init";
import { isAppError, toErrorResponse } from "@/lib/errors";
import { clientIdentity, enforceRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    await enforceRateLimit("public-webform", clientIdentity(req.headers), 20, 15 * 60 * 1000);
    const size = Number(req.headers.get("content-length") || 0);
    if (size > 32768) return NextResponse.json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    const chunks: Uint8Array[] = [];
    const reader = req.body?.getReader();
    let received = 0;
    if (reader) while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > 32768) { await reader.cancel(); return NextResponse.json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, { status: 413 }); }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks);

    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      body = JSON.parse(raw.toString("utf8")) as Record<string, string>;
    } else {
      const fd = await new Response(raw, { headers: { "content-type": contentType } }).formData();
      body = Object.fromEntries(
        [...fd.entries()].map(([k, v]) => [k, String(v)]),
      );
    }

    const companySlug = String(body.companySlug || body.slug || "").trim();
    const contactName = String(body.contactName || body.name || "").trim();
    const email = String(body.email || "").trim() || undefined;
    const phone = String(body.phone || "").trim() || undefined;
    const companyName = String(body.companyName || "").trim() || undefined;
    const message = String(body.message || body.notes || "").trim() || undefined;
    const title = String(body.title || "").trim() || undefined;
    const redirectTo = String(body.redirectTo || "").trim();
    const redirectUrl = redirectTo ? new URL(redirectTo, req.url) : null;
    if (redirectUrl && redirectUrl.origin !== req.nextUrl.origin) {
      return NextResponse.json({ ok: false, code: "INVALID_REDIRECT" }, { status: 400 });
    }

    const parsed = z.object({ companySlug: z.string().min(1).max(160), contactName: z.string().min(1).max(160),
      email: z.string().email().max(254).optional(), phone: z.string().max(40).optional(), companyName: z.string().max(200).optional(),
      message: z.string().max(5000).optional(), title: z.string().max(200).optional() }).safeParse({
      companySlug,
      contactName,
      email,
      phone,
      companyName,
      message,
      title,
    });
    if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION" }, { status: 400 });
    const result = await createInboundLead(parsed.data);

    if (redirectUrl) {
      redirectUrl.searchParams.set("sent", result.duplicate ? "duplicate" : "1");
      return NextResponse.redirect(redirectUrl, 303);
    }

    return NextResponse.json({
      ok: true,
      leadId: result.leadId,
      duplicate: result.duplicate,
    });
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof TypeError) return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
    if (isAppError(err)) {
      const { error, status } = toErrorResponse(err);
      return NextResponse.json({ ok: false, ...error }, { status,
        headers: status === 429 ? { "Retry-After": String(err.details?.retryAfter || 60) } : undefined });
    }
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ ok: false, ...error }, { status });
  }
}
