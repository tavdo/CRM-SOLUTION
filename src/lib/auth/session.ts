import { sessionSecret } from "@/lib/auth/demo";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "../db";
import { ensureDbInitialized } from "../db-init";
import { hashToken } from "../crypto";

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
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({
    sub: userId,
    email: user?.email ?? "",
    name: user?.name ?? "",
    preferredLocale: user?.preferredLocale ?? "en",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionSecret());

  // Also record in Session table best-effort
  await prisma.session
    .create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: meta?.userAgent?.slice(0, 255),
        ip: meta?.ip?.slice(0, 64),
      },
    })
    .catch(() => {});

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
    await ensureDbInitialized().catch(() => {});
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;

    await ensureDbInitialized();

    // 1. Verify stateless signed JWT (works across all serverless containers)
    try {
      const { payload } = await jwtVerify(token, sessionSecret());
      const userId = typeof payload.sub === "string" ? payload.sub : null;
      const email = typeof payload.email === "string" ? payload.email : null;

      let user = userId
        ? await prisma.user.findUnique({ where: { id: userId } })
        : null;
      if (!user && email) {
        user = await prisma.user.findUnique({ where: { email } });
      }

      if (user) {
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          preferredLocale: user.preferredLocale,
          emailVerifiedAt: user.emailVerifiedAt,
        };
      }
    } catch {
      // Fallback to DB session token lookup
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      preferredLocale: session.user.preferredLocale,
      emailVerifiedAt: session.user.emailVerifiedAt,
    };
  } catch (err) {
    console.error("[getSessionUser]", err instanceof Error ? err.message : err);
    return null;
  }
}

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
