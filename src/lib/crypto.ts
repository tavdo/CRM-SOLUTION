import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { AppError } from "./errors";

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new AppError("Password must be at least 8 characters", "WEAK_PASSWORD");
  if (Buffer.byteLength(password, "utf8") > 72) throw new AppError("Password is too long", "WEAK_PASSWORD");
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
