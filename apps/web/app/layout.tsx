import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Atkinson_Hyperlegible, Big_Shoulders } from "next/font/google";
import { Shell } from "./shell";
import "./globals.css";

// Self-hosted at build time by next/font: no runtime request to Google, CSP font-src stays 'self'.
const display = Big_Shoulders({ subsets: ["latin", "latin-ext"], weight: ["800", "900"], variable: "--kf-display", display: "swap", adjustFontFallback: false });
// Designed for low vision and glare: a good fit for a phone on a market table.
const body = Atkinson_Hyperlegible({ subsets: ["latin", "latin-ext"], weight: ["400", "700"], variable: "--kf-body", display: "swap" });

export const metadata: Metadata = {
  title: "Konfam",
  description: "Your phone shouts when the money is REAL. A talking Lightning till with receipts nobody can forge.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffd23f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers makes every page dynamic, which the per-request CSP nonce requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const demo = process.env.DEMO_MODE === "1";
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <Shell demo={demo} nonce={nonce}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
