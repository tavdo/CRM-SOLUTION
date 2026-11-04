import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "../errors";

function key() {
  const encoded = process.env.INBOX_ENCRYPTION_KEY ?? "";
  const value = Buffer.from(encoded, "base64");
  if (value.length !== 32) throw new AppError("Configure INBOX_ENCRYPTION_KEY (32 random bytes, base64)", "INBOX_KEY_MISSING", 503);
  return value;
}
export function encrypt(value: unknown, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
export function decrypt<T>(value: string, context: string): T {
  try {
    const [version, iv, tag, data] = value.split(".");
    if (version !== "v1" || !iv || !tag || !data) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")) as T;
  } catch { throw new AppError("Inbox credentials are unavailable", "INBOX_DECRYPT", 503); }
}
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function equalDigest(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
