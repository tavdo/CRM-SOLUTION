import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../db";
import { can } from "../permissions";
import { AppError } from "../errors";
import type { WorkspaceContext } from "../auth/workspace";
import { projectAccess } from "./access";
import { parse, audit, missing } from "./core";

const root = () => path.join(process.cwd(), "storage", "construction");
const categories = ["PHOTO", "DRAWING", "REPORT", "CONTRACT", "ACT", "OTHER"] as const;
export function fileType(bytes: Uint8Array): { extension: string; mime: string } | null {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: "png", mime: "image/png" };
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return { extension: "jpg", mime: "image/jpeg" };
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return { extension: "webp", mime: "image/webp" };
  if (b.subarray(0, 5).toString() === "%PDF-") return { extension: "pdf", mime: "application/pdf" };
  return null;
}
export async function saveDocument(ctx: WorkspaceContext, projectId: string, input: { category: string; reportId?: string }, file: File) {
  if (process.env.VERCEL) throw new AppError("Durable file storage is not configured", "C_STORAGE", 503);
  await projectAccess(ctx, projectId);
  const { category, reportId } = parse(z.object({ category: z.enum(categories), reportId: z.string().optional() }), input);
  if (!can(ctx.role, "construction.finance") && !["PHOTO", "DRAWING", "REPORT"].includes(category)) throw new AppError("Forbidden", "FORBIDDEN", 403);
  if (file.size < 1 || file.size > 8 * 1024 * 1024) throw new AppError("Invalid file size", "C_FILE", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = fileType(bytes);
  if (!type || (category === "PHOTO" && !type.mime.startsWith("image/"))) throw new AppError("Unsupported file", "C_FILE", 400);
  const storageKey = `${randomUUID()}.${type.extension}`;
  await mkdir(root(), { recursive: true });
  await writeFile(path.join(root(), storageKey), bytes, { flag: "wx" });
  try {
    return await prisma.$transaction(async (db) => {
      await projectAccess(ctx, projectId, db);
      if (reportId && !await db.siteReport.findFirst({ where: { id: reportId, companyId: ctx.company.id, projectId } })) missing();
      const document = await db.projectDocument.create({ data: { companyId: ctx.company.id, projectId, category, reportId: reportId || null, storageKey, name: path.basename(file.name.replaceAll("\\", "/")).slice(0, 200), mimeType: type.mime, size: bytes.length, createdById: ctx.user.id } });
      await audit(db, ctx, "document.uploaded", projectId);
      return document;
    });
  } catch (error) { await unlink(path.join(root(), storageKey)); throw error; }
}
export async function readDocument(ctx: WorkspaceContext, documentId: string) {
  const document = await prisma.projectDocument.findFirst({ where: { id: documentId, companyId: ctx.company.id } });
  if (!document) missing();
  await projectAccess(ctx, document.projectId);
  if (!can(ctx.role, "construction.finance") && !["PHOTO", "DRAWING", "REPORT"].includes(document.category)) throw new AppError("Forbidden", "FORBIDDEN", 403);
  if (!/^[\da-f-]+\.(png|jpg|webp|pdf)$/.test(document.storageKey)) missing();
  return { document, bytes: await readFile(path.join(root(), document.storageKey)) };
}
