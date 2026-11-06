import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  if (process.env.DEPLOYMENT_MODE === "preview") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: ["/", "/ka$", "/en$", ...["ka", "en"].flatMap(locale => ["privacy", "terms", "contact"].map(page => `/${locale}/${page}$`))],
    disallow: ["/api/", "/ka/", "/en/"] }],
    ...(process.env.APP_URL?.startsWith("https://") ? { sitemap: `${process.env.APP_URL.replace(/\/$/, "")}/sitemap.xml` } : {}) };
}
