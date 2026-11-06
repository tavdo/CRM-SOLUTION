import type { Metadata } from "next";
export function publicMetadata(locale: "ka" | "en", path = "", title?: string): Metadata {
  const base = new URL(process.env.APP_URL || "http://localhost:3000");
  const description = locale === "ka" ? "კლიენტები, გაყიდვები და პროექტები ერთ სამუშაო სივრცეში — CRM Solution." : "Customers, sales and projects in one workspace — CRM Solution.";
  return { metadataBase: base, title: title || "CRM Solution", description,
    alternates: { canonical: `/${locale}${path}`, languages: { ka: `/ka${path}`, en: `/en${path}` } },
    openGraph: { title: title || "CRM Solution", description, url: `/${locale}${path}`, siteName: "CRM Solution",
      locale: locale === "ka" ? "ka_GE" : "en_US", type: "website", images: [{ url: "/images/dashboard-crm.webp", alt: "CRM Solution" }] },
    twitter: { card: "summary_large_image", title: title || "CRM Solution", description, images: ["/images/dashboard-crm.webp"] } };
}
