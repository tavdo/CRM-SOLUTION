import { prisma } from "./db";

export async function writeAudit(params: {
  companyId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  // Never persist secrets — callers must scrub
  const safe = params.detail
    ? JSON.stringify(scrubSecrets(params.detail))
    : null;

  await prisma.auditEvent.create({
    data: {
      companyId: params.companyId,
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      detail: safe,
    },
  });
}

const SECRET_KEYS = /password|token|secret|hash|authorization|cookie/i;

function scrubSecrets(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.test(k)) {
      out[k] = "[redacted]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = scrubSecrets(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
