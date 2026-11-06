import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.DEPLOYMENT_MODE === "live" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }];
  },
  ...(process.env.DEPLOYMENT_MODE === "demo" ? { outputFileTracingIncludes: { "/**": ["./prisma/deployment-demo.db"] } } : {}),
  outputFileTracingExcludes: {
    "/**": ["./.env*", "./backups/**", "./storage/**", "./.launch-verify/**", "./prisma/dev.db*", "./prisma/contractor-preview.db*",
      ...(process.env.DEPLOYMENT_MODE !== "demo" ? ["./prisma/*.db"] : [])],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default withNextIntl(nextConfig);
