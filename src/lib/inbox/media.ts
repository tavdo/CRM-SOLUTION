import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHmac } from "node:crypto";
import { putPrivateObject, getPrivateObject } from "../storage";
import { ChannelError } from "./types";
import { equalDigest } from "./credentials";

const MAX_SIZE = 20 * 1024 * 1024;
const root = () => path.resolve(process.env.INBOX_STORAGE_PATH || "storage/inbox");
export function safeMediaUrl(value: string) {
  const url = new URL(value);
  const hosts = ["fbcdn.net", "fbsbx.com", "facebook.com", "cdninstagram.com", "viber.com"];
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
    !hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new ChannelError("MEDIA_HOST_BLOCKED");
  return url;
}
export async function fetchMedia(value: string, authorization?: string) {
  let url = safeMediaUrl(value); const authHost = url.hostname;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(url, { redirect: "manual", headers: authorization && url.hostname === authHost ? { Authorization: authorization } : {}, signal: AbortSignal.timeout(30000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); if (!location) throw new ChannelError("MEDIA_REDIRECT");
      url = safeMediaUrl(new URL(location, url).href); continue;
    }
    if (!response.ok) throw new ChannelError(`MEDIA_HTTP_${response.status}`, response.status >= 500 || response.status === 429);
    if (Number(response.headers.get("content-length")) > MAX_SIZE || !response.body) throw new ChannelError("MEDIA_TOO_LARGE");
    const chunks: Uint8Array[] = []; let length = 0;
    const reader = response.body.getReader();
    while (true) {
      const { value: chunk, done } = await reader.read(); if (done) break;
      length += chunk.byteLength;
      if (length > MAX_SIZE) { await reader.cancel(); throw new ChannelError("MEDIA_TOO_LARGE"); }
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks), mime: (response.headers.get("content-type") || "application/octet-stream").split(";")[0] };
  }
  throw new ChannelError("MEDIA_REDIRECT");
}
export async function storeMedia(companyId: string, bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_SIZE) throw new ChannelError("MEDIA_TOO_LARGE");
  const key = `${companyId}/${randomUUID()}`;
  if (process.env.INBOX_STORAGE === "s3") {
    if (!process.env.S3_BUCKET) throw new ChannelError("STORAGE_NOT_CONFIGURED");
    await putPrivateObject(`inbox/${key}`, bytes, mime);
  } else {
    if (process.env.VERCEL) throw new ChannelError("STORAGE_NOT_DURABLE");
    await mkdir(path.join(root(), companyId), { recursive: true });
    await writeFile(path.join(root(), key), bytes, { flag: "wx" });
  }
  return key;
}
export async function readMedia(companyId: string, key: string) {
  if (!key.startsWith(`${companyId}/`) || !/^[a-zA-Z0-9_-]+\/[\da-f-]+$/.test(key)) throw new ChannelError("MEDIA_NOT_FOUND");
  if (process.env.INBOX_STORAGE === "s3") {
    return getPrivateObject(`inbox/${key}`, MAX_SIZE);
  }
  return readFile(path.join(root(), key));
}
export function shareToken(id: string, expires: number) {
  if (!process.env.INBOX_ENCRYPTION_KEY) throw new ChannelError("STORAGE_NOT_CONFIGURED");
  return createHmac("sha256", process.env.INBOX_ENCRYPTION_KEY).update(`${id}:${expires}`).digest("hex");
}
export function verifyShare(id: string, expires: number, token: string) {
  return Number.isFinite(expires) && expires > Date.now() && expires < Date.now() + 31 * 60 * 1000 && equalDigest(token, shareToken(id, expires));
}
export function mediaShareUrl(id: string, name: string) {
  const base = process.env.APP_URL;
  if (!base || !base.startsWith("https://")) throw new ChannelError("PUBLIC_HTTPS_URL_REQUIRED");
  const expires = Date.now() + 30 * 60 * 1000;
  return `${base.replace(/\/$/, "")}/api/inbox/media-share/${id}/${encodeURIComponent(name)}?expires=${expires}&token=${shareToken(id, expires)}`;
}
