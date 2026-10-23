import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/db-init";

const COOKIE = "crm_session";
const WORKSPACE_COOKIE = "crm_workspace";
const SESSION_DAYS = 14;

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    "vercel-owner-demo-session-secret-change-before-live";
  return new TextEncoder().encode(secret);
}

export async function GET(req: NextRequest) {
  try {
    await ensureDbInitialized();

    const email =
      req.nextUrl.searchParams.get("email") || "admin@demo-alpha.local";
    const localeParam = req.nextUrl.searchParams.get("locale");
    const locale = localeParam === "ka" ? "ka" : "en";

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.redirect(new URL(`/${locale}/sign-in`, req.url));
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      preferredLocale: user.preferredLocale,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DAYS}d`)
      .sign(getJwtSecret());

    const expiresAt = new Date(
      Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    );

    const res = NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));

    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    if (membership) {
      res.cookies.set(WORKSPACE_COOKIE, membership.companyId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return res;
  } catch (err) {
    console.error("[api/demo-login]", err);
    return NextResponse.json(
      {
        error: "Demo login initialization failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
