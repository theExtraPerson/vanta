import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand } from "@/lib/brand";
import { siteUrl } from "@/lib/supabase/config";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Vanta Fintech runs five long-term VINTA plans from UGX 20,000 with daily earnings credited to your wallet, plus a 17% / 1% two-level referral programme. Invest smartly, earn consistently, grow your wealth.",
  keywords: [
    "Vanta Fintech",
    "invest Uganda",
    "UGX long-term plans",
    "daily earnings",
    "referral program",
    "mobile money investment",
  ],
  authors: [{ name: brand.legalName }],
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description:
      "Five long-term VINTA plans. Daily earnings. 17% first-level referral commission. Invest smartly, earn consistently, grow your wealth.",
    url: siteUrl,
    images: [{ url: "/brand/logo.jpg", width: 1536, height: 1024, alt: brand.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — ${brand.tagline}`,
    description: "Five long-term VINTA plans with daily earnings and a 17% referral programme.",
    images: ["/brand/logo.jpg"],
  },
  icons: {
    icon: [{ url: "/brand/mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/logo-square.jpg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050a14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Exo+2:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-ink antialiased">{children}</body>
    </html>
  );
}
