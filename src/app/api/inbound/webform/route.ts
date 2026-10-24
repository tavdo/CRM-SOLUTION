import { NextRequest, NextResponse } from "next/server";
import { createInboundLead } from "@/lib/services/leads";
import { ensureDbInitialized } from "@/lib/db-init";
import { isAppError, toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();

    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, string>;
    } else {
      const fd = await req.formData();
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

    const result = await createInboundLead({
      companySlug,
      contactName,
      email,
      phone,
      companyName,
      message,
      title,
    });

    if (redirectTo) {
      const url = new URL(redirectTo, req.url);
      url.searchParams.set("sent", result.duplicate ? "duplicate" : "1");
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json({
      ok: true,
      leadId: result.leadId,
      duplicate: result.duplicate,
    });
  } catch (err) {
    if (isAppError(err)) {
      const { error, status } = toErrorResponse(err);
      return NextResponse.json({ ok: false, ...error }, { status });
    }
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ ok: false, ...error }, { status });
  }
}
