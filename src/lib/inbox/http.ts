import { NextResponse } from "next/server";
import { AppError } from "../errors";
import { prisma } from "../db";
import { ZodError } from "zod";
import type { WorkspaceContext } from "../auth/workspace";
export function inboxError(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON" } }, { status: 400 });
  if (error instanceof ZodError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Check the submitted fields" } }, { status: 400 });
  // Provider URLs, payloads and raw exceptions may include tokens. Return/log codes only.
  if (error instanceof AppError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error("[inbox] operation_failed");
  return NextResponse.json({ error: { code: "INBOX_INTERNAL", message: "Inbox operation failed" } }, { status: 500 });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) throw new AppError("Invalid origin", "FORBIDDEN", 403);
}
export async function limitedBody(request: Request, max = 1024 * 1024) {
  return Buffer.from(await limitedBytes(request, max)).toString("utf8");
}
export async function limitedBytes(request: Request, max = 1024 * 1024) {
  if (Number(request.headers.get("content-length")) > max) throw new AppError("Request too large", "TOO_LARGE", 413);
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new AppError("Request too large", "TOO_LARGE", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function audit(ctx: WorkspaceContext, action: string, entityId: string) {
  await prisma.auditEvent.create({ data: { companyId: ctx.company.id, actorId: ctx.user.id, action, entityType: "inbox", entityId } });
}
