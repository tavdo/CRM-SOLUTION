import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Manrope, Fraunces, Noto_Sans_Georgian } from "next/font/google";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import "./globals.css";
import "./crm-workspace.css";
import "./landing-workspace.css";
import "./inbox.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
});

const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto-georgian",
  subsets: ["georgian", "latin"],
});

export const metadata: Metadata = {
  title: "CRM Solution",
  description: "Multi-tenant subscription CRM for growing teams",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("crm-theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const saved=localStorage.getItem("crm-theme");if(saved==="light"||saved==="dark")document.documentElement.dataset.theme=saved}catch{}` }} />
      </head>
      <body className={`${manrope.variable} ${fraunces.variable} ${notoGeorgian.variable} antialiased`}>
        <AnimatedBackground />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
