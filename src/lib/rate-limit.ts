import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "./db";
import { AppError } from "./errors";
import { sessionSecret } from "./auth/demo";

type RequestHeaders = Pick<Headers, "get">;

/** Only trust a header explicitly configured and overwritten by the host/proxy. */
export function clientIdentity(headers: RequestHeaders): string {
  const trusted = process.env.TRUSTED_IP_HEADER;
  if (!trusted) return "shared-unattributed-client";
  const value = headers.get(trusted)?.trim();
  // Multi-hop lists are ambiguous. Configure a single-IP header at the edge.
  return value && isIP(value) ? value : "shared-unattributed-client";
}

/** Atomic, shared fixed-window limits work across web instances without Redis. */
export async function enforceRateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const key = createHmac("sha256", sessionSecret()).update(`${scope}:${identity}:${window}`).digest("hex");
  const expiresAt = new Date((window + 1) * windowMs);
  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key }, create: { key, attempts: 1, expiresAt }, update: { attempts: { increment: 1 } },
  });
  if (bucket.attempts > limit) {
    throw new AppError("Too many attempts. Please try again later.", "RATE_LIMIT", 429,
      { retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)) });
  }
}

export async function limitAuthRequest(action: string, headers: RequestHeaders, email?: string) {
  const windowMs = action === "sign-up" ? 60 * 60 * 1000 : 15 * 60 * 1000;
  const limit = action === "sign-up" ? 5 : action === "reset-request" ? 10 : 30;
  await enforceRateLimit(`auth:${action}:client`, clientIdentity(headers), limit, windowMs);
  if (email) await enforceRateLimit(`auth:${action}:account`, email.trim().toLowerCase(),
    action === "sign-in" ? 10 : 5, windowMs);
}
