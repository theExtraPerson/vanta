import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { siteUrl } from "@/lib/supabase/config";

/**
 * PWA manifest — lets Chromium browsers offer "Install app" (the Download
 * tile in Quick Actions) and gives iOS Safari everything it needs for
 * Add-to-Home-Screen. Next serves this at /manifest.webmanifest and links it
 * automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — ${brand.tagline}`,
    short_name: brand.shortName,
    description:
      "Long-term VINTA plans with daily earnings, mobile money deposits and payouts, and a two-level referral programme.",
    id: "/dashboard",
    start_url: "/dashboard?utm_source=pwa",
    scope: "/",
    dir: "ltr",
    lang: "en",
    orientation: "portrait",
    display: "standalone",
    background_color: "#050a14",
    theme_color: "#050a14",
    categories: ["finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Deposit",
        url: "/dashboard/wallet?tab=deposit",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Withdraw",
        url: "/dashboard/wallet?tab=withdraw",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
