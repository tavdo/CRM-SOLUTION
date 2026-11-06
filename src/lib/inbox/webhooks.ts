import { prisma } from "../db";
import { AppError } from "../errors";
import { decrypt, digest, encrypt, equalDigest } from "./credentials";
import type { Credentials } from "./types";
import { facebook } from "./adapters/facebook";

export async function webhookIntegration(id: string, provider: string) {
  if (process.env.INBOX_ENABLED === "false") throw new AppError("Messaging is not available", "INBOX_DISABLED", 503);
  const integration = await prisma.inboxIntegration.findFirst({ where: { id, provider, status: "ACTIVE" } });
  if (!integration) throw new AppError("Not found", "NOT_FOUND", 404);
  return integration;
}
export async function verifyChallenge(id: string, mode: string | null, token: string | null, challenge: string | null) {
  const integration = await webhookIntegration(id, "META");
  if (mode !== "subscribe" || !token || !challenge || challenge.length > 512 || !equalDigest(digest(token), integration.verifyTokenHash)) {
    throw new AppError("Invalid verification token", "INBOX_VERIFY", 403);
  }
  return challenge;
}
export async function receiveWebhook(id: string, provider: string, raw: string, signature: string | null, verify = facebook.verifyWebhook) {
  const integration = await webhookIntegration(id, provider);
  const credentials = decrypt<Credentials>(integration.credentialsEncrypted, integration.companyId);
  if (!verify(raw, signature, credentials.appSecret || credentials.accessToken)) throw new AppError("Invalid signature", "INBOX_SIGNATURE", 401);
  try { JSON.parse(raw); } catch { throw new AppError("Invalid JSON", "INBOX_PAYLOAD", 400); }
  const hash = digest(raw);
  const existing = await prisma.inboxWebhookEvent.findUnique({ where: { integrationId_digest: { integrationId: id, digest: hash } }, select: { id: true } });
  if (existing) return;
  if (await prisma.inboxWebhookEvent.count({ where: { integrationId: id, createdAt: { gt: new Date(Date.now() - 60000) } } }) >= 2000) {
    throw new AppError("Webhook rate limit reached; retry later", "RATE_LIMIT", 429);
  }
  await prisma.$transaction(async db => {
    const event = await db.inboxWebhookEvent.upsert({ where: { integrationId_digest: { integrationId: id, digest: hash } }, update: {},
      create: { companyId: integration.companyId, integrationId: id, digest: hash, payloadEncrypted: encrypt(raw, integration.companyId) } });
    await db.inboxOutboxEvent.upsert({ where: { kind_recordId: { kind: "WEBHOOK", recordId: event.id } }, update: {},
      create: { companyId: integration.companyId, kind: "WEBHOOK", recordId: event.id } });
  });
}
