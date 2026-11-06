import { sessionSecret, isBlockedDemoAccount } from "@/lib/auth/demo";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "../db";
import { ensureDbInitialized } from "../db-init";
import { hashToken } from "../crypto";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { previewEmailAllowed } from "../release-access";

const COOKIE = "crm_session";
const WORKSPACE_COOKIE = "crm_workspace";
const SESSION_DAYS = 14;



export type SessionUser = {
  id: string;
  email: string;
  name: string;
  preferredLocale: string;
  emailVerifiedAt: Date | null;
};

export async function createSession(
  userId: string,
  meta?: { userAgent?: string; ip?: string },
): Promise<string> {
  await ensureDbInitialized();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || isBlockedDemoAccount(user.email) || !previewEmailAllowed(user.email)) throw new Error("Session user is unavailable");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({
    sub: userId,
    email: user?.email ?? "",
    name: user?.name ?? "",
    preferredLocale: user?.preferredLocale ?? "en",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionSecret());

  // A persisted session is authoritative: failure must never create a login.
  await prisma.session
    .create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: meta?.userAgent?.slice(0, 255),
        ip: meta?.ip?.slice(0, 64),
      },
    });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await ensureDbInitialized();
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(COOKIE);
}

// Deduplicate layout/page reads only within a React Server Component render.
// Route handlers and SSE calls run outside that cache and still revalidate auth.
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;

    await ensureDbInitialized();

    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.userId !== payload.sub || session.expiresAt <= new Date() || isBlockedDemoAccount(session.user.email) || !previewEmailAllowed(session.user.email)) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      preferredLocale: session.user.preferredLocale,
      emailVerifiedAt: session.user.emailVerifiedAt,
    };
  } catch {
    return null;
  }
});

export async function setActiveWorkspace(companyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(WORKSPACE_COOKIE)?.value ?? null;
}

export async function clearActiveWorkspace(): Promise<void> {
  const jar = await cookies();
  jar.delete(WORKSPACE_COOKIE);
}
