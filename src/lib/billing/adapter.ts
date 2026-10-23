import { createHmac, timingSafeEqual } from "crypto";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";

/**
 * Billing adapter:
 * - "dev": development/test provider — signs events with BILLING_WEBHOOK_SECRET
 * - Production Stripe (or other) activation requires owner credentials and approval
 *
 * Prices in Plan are configurable placeholders, not approved commercial terms.
 */

export type BillingWebhookEvent = {
  id: string;
  type:
    | "subscription.activated"
    | "subscription.payment_failed"
    | "subscription.canceled"
    | "subscription.expired"
    | "subscription.renewed";
  subscriptionExternalId?: string;
  companyId?: string;
  occurredAt?: string;
};

export function signDevPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyWebhookSignature(
  body: string,
  signature: string | null,
): boolean {
  const provider = process.env.BILLING_PROVIDER ?? "dev";
  const secret = process.env.BILLING_WEBHOOK_SECRET ?? "";
  if (!signature || !secret) return false;

  if (provider === "dev") {
    const expected = signDevPayload(body, secret);
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  // Stripe path reserved — not activated without credentials
  throw new AppError(
    "Stripe billing is not activated. Set BILLING_PROVIDER=dev or configure Stripe credentials.",
    "BILLING_NOT_CONFIGURED",
    501,
  );
}

export async function processBillingEvent(
  event: BillingWebhookEvent,
  rawPayload: string,
): Promise<{ duplicate: boolean }> {
  const provider = process.env.BILLING_PROVIDER ?? "dev";

  const existing = await prisma.billingEvent.findUnique({
    where: {
      provider_externalEventId: {
        provider,
        externalEventId: event.id,
      },
    },
  });
  if (existing) return { duplicate: true };

  const subscription = await findSubscription(event);
  if (!subscription) {
    throw new AppError("Subscription not found", "NOT_FOUND", 404);
  }

  const status = mapEventToStatus(event.type);
  const data: {
    status?: SubscriptionStatus;
    lastPaymentFailureAt?: Date;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: Date;
    currentPeriodStart?: Date;
  } = {};

  if (status) data.status = status;
  if (event.type === "subscription.payment_failed") {
    data.lastPaymentFailureAt = new Date();
    data.status = "PAST_DUE";
  }
  if (event.type === "subscription.canceled") {
    data.cancelAtPeriodEnd = true;
    data.status = "CANCELED";
  }
  if (event.type === "subscription.renewed" || event.type === "subscription.activated") {
    data.status = "ACTIVE";
    data.currentPeriodStart = new Date();
    data.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    data.cancelAtPeriodEnd = false;
  }

  await prisma.$transaction([
    prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        provider,
        externalEventId: event.id,
        eventType: event.type,
        payload: rawPayload,
      },
    }),
    prisma.subscription.update({
      where: { id: subscription.id },
      data,
    }),
  ]);

  await writeAudit({
    companyId: subscription.companyId,
    action: `billing.${event.type}`,
    entityType: "subscription",
    entityId: subscription.id,
    detail: { provider, eventId: event.id },
  });

  return { duplicate: false };
}

async function findSubscription(event: BillingWebhookEvent) {
  if (event.companyId) {
    return prisma.subscription.findUnique({ where: { companyId: event.companyId } });
  }
  if (event.subscriptionExternalId) {
    return prisma.subscription.findFirst({
      where: { externalSubscriptionId: event.subscriptionExternalId },
    });
  }
  return null;
}

function mapEventToStatus(
  type: BillingWebhookEvent["type"],
): SubscriptionStatus | null {
  switch (type) {
    case "subscription.activated":
    case "subscription.renewed":
      return "ACTIVE";
    case "subscription.payment_failed":
      return "PAST_DUE";
    case "subscription.canceled":
      return "CANCELED";
    case "subscription.expired":
      return "EXPIRED";
    default:
      return null;
  }
}

/** Subscription gates — never delete customer data on payment failure. */
export function isSubscriptionUsable(
  status: SubscriptionStatus | undefined | null,
): boolean {
  return status === "TRIALING" || status === "ACTIVE" || status === "PAST_DUE";
}

export async function enforcePlanLimit(
  companyId: string,
  kind: "users" | "customers" | "deals",
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });
  if (!sub || !isSubscriptionUsable(sub.status)) {
    throw new AppError(
      "Subscription inactive. Contact your administrator.",
      "SUBSCRIPTION_INACTIVE",
      402,
    );
  }

  if (kind === "users") {
    const count = await prisma.membership.count({ where: { companyId } });
    if (count >= sub.plan.maxUsers) {
      throw new AppError("User limit reached for current plan", "LIMIT_USERS", 402);
    }
  }
  if (kind === "customers") {
    const count = await prisma.customer.count({
      where: { companyId, archivedAt: null },
    });
    if (count >= sub.plan.maxCustomers) {
      throw new AppError(
        "Customer limit reached for current plan",
        "LIMIT_CUSTOMERS",
        402,
      );
    }
  }
  if (kind === "deals") {
    const count = await prisma.deal.count({
      where: { companyId, archivedAt: null },
    });
    if (count >= sub.plan.maxDeals) {
      throw new AppError("Deal limit reached for current plan", "LIMIT_DEALS", 402);
    }
  }
}
