import type { Metadata } from "next";
import { Manrope, Fraunces, Noto_Sans_Georgian } from "next/font/google";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("crm-theme")==="light"?"light":"dark"}catch{}` }} />
      </head>
      <body className={`${manrope.variable} ${fraunces.variable} ${notoGeorgian.variable} antialiased`}>
        <AnimatedBackground />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
