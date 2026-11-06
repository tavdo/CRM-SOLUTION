import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.DEPLOYMENT_MODE === "preview") return [];
  const base = process.env.APP_URL;
  if (!base?.startsWith("https://")) return [];
  return ["ka", "en"].flatMap(locale => ["", "/privacy", "/terms", "/contact"].map(page => ({ url: `${base.replace(/\/$/, "")}/${locale}${page}` })));
}
