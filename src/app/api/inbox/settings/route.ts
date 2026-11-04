import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requireInbox } from "@/lib/inbox/access";
import { inboxError, limitedBody, sameOrigin } from "@/lib/inbox/http";
import { checkChannel, connectChannel, disconnectChannel } from "@/lib/services/inbox";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { mergeContacts, mergePreview } from "@/lib/inbox/merging";
import { decrypt } from "@/lib/inbox/credentials";
import type { Credentials } from "@/lib/inbox/types";

export async function POST(request: Request) {
  try {
    sameOrigin(request); const ctx = await requireWorkspace(); requireInbox(ctx);
    const body = z.record(z.string(), z.unknown()).parse(JSON.parse(await limitedBody(request, 24000)));
    const action = z.string().parse(body.action);
    if (action === "availability") {
      const available = z.boolean().parse(body.available);
      await prisma.inboxAgent.upsert({ where: { companyId_userId: { companyId: ctx.company.id, userId: ctx.user.id } },
        create: { companyId: ctx.company.id, userId: ctx.user.id, available }, update: { available } });
      return Response.json({ ok: true });
    }
    requireInbox(ctx, true);
    if (action === "connect") return Response.json(await connectChannel(ctx, body));
    if (action === "check") return Response.json(await checkChannel(ctx, z.string().parse(body.id)));
    if (action === "merge-preview" || action === "merge") {
      const sourceId = z.string().parse(body.sourceId); const targetId = z.string().parse(body.targetId);
      return Response.json(action === "merge" ? await mergeContacts(ctx, sourceId, targetId) : await mergePreview(ctx, sourceId, targetId));
    }
    if (action === "quick-reply") {
      const data = z.object({ title: z.string().trim().min(1).max(80), text: z.string().trim().min(1).max(4000) }).parse(body);
      return Response.json(await prisma.inboxQuickReply.create({ data: { ...data, companyId: ctx.company.id } }));
    }
    if (action === "retry-webhook") {
      const id = z.string().parse(body.id);
      await prisma.$transaction(async db => {
        const row = await db.inboxWebhookEvent.findFirst({ where: { id, companyId: ctx.company.id, status: "FAILED" } });
        if (!row) throw new AppError("Event not found", "NOT_FOUND", 404);
        await db.inboxWebhookEvent.update({ where: { id }, data: { status: "PENDING" } });
        await db.inboxOutboxEvent.deleteMany({ where: { kind: "WEBHOOK", recordId: id, companyId: ctx.company.id } });
        await db.inboxOutboxEvent.create({ data: { companyId: ctx.company.id, kind: "WEBHOOK", recordId: id } });
      });
      return Response.json({ ok: true });
    }
    const id = z.string().parse(body.id);
    const channel = await prisma.inboxChannel.findFirst({ where: { id, companyId: ctx.company.id }, include: { integration: true } });
    if (!channel) throw new AppError("Not found", "NOT_FOUND", 404);
    if (action === "verify-token") return Response.json({ verifyToken: decrypt<Credentials>(channel.integration.credentialsEncrypted, ctx.company.id).verifyToken || "" }, { headers: { "Cache-Control": "no-store" } });
    if (action === "disconnect") {
      return Response.json(await disconnectChannel(ctx, id));
    }
    if (action === "automation") {
      const settings = z.object({ welcome: z.string().max(2000), away: z.string().max(2000), timezone: z.string().max(80),
        startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24), workDays: z.array(z.number().int().min(0).max(6)).max(7) }).parse(body);
      try { new Intl.DateTimeFormat("en", { timeZone: settings.timezone }); } catch { throw new AppError("Invalid timezone", "INVALID_TIMEZONE", 400); }
      if (settings.startHour >= settings.endHour) throw new AppError("Closing hour must follow opening hour", "INVALID_HOURS", 400);
      await prisma.inboxChannel.update({ where: { id }, data: { settingsJson: JSON.stringify(settings) } });
      return Response.json({ ok: true });
    }
    throw new AppError("Unknown action", "INVALID_INPUT", 400);
  } catch (error) { return inboxError(error); }
}
