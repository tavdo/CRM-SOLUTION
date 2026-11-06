import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./i18n/config";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "always",
});

const PUBLIC = [
  /^\/(en|ka)$/,
  /^\/(en|ka)\/(privacy|terms|contact)\/?$/,
  /^\/(en|ka)\/sign-in/,
  /^\/(en|ka)\/sign-up/,
  /^\/(en|ka)\/forgot-password/,
  /^\/(en|ka)\/reset-password/,
  /^\/(en|ka)\/verify-email/,
  /^\/(en|ka)\/invite\//,
  /^\/(en|ka)\/f\//,
  /^\/api\/health/,
  /^\/api\/billing\/webhook/,
  /^\/api\/inbound\//,
  /^\/api\/demo-login/,
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const response = intlMiddleware(req);
  // Public lead forms are deliberately embeddable on customer websites.
  if (!/^\/(en|ka)\/f\//.test(pathname)) response.headers.set("X-Frame-Options", "SAMEORIGIN");
  if (/^\/(en|ka)\/(sign-in|sign-up|forgot-password|reset-password|verify-email|invite|f)(\/|$)/.test(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  const isPublic = PUBLIC.some((re) => re.test(pathname));
  const session = req.cookies.get("crm_session")?.value;

  if (!isPublic && !session) {
    const locale = pathname.split("/")[1] || defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/(en|ka)/:path*", "/api/:path*"],
};
