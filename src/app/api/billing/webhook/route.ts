import { NextRequest, NextResponse } from "next/server";
import {
  processBillingEvent,
  verifyWebhookSignature,
  type BillingWebhookEvent,
} from "@/lib/billing/adapter";
import { isAppError } from "@/lib/errors";

/**
 * Development billing webhook.
 * Sign body with HMAC-SHA256 using BILLING_WEBHOOK_SECRET (hex digest).
 * Duplicate external event IDs are acknowledged without re-processing.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-billing-signature");

  try {
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const event = JSON.parse(body) as BillingWebhookEvent;
    if (!event.id || !event.type) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const result = await processBillingEvent(event, body);
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    if (isAppError(err)) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    console.error("[billing.webhook]", err instanceof Error ? err.message : "error");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
