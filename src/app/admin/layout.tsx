import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { VantaMark } from "@/components/brand/VantaMark";
import { isSessionAdmin } from "@/lib/admin/data";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ops Desk",
  description: "Vanta Fintech operator desk.",
  robots: { index: false, follow: false },
};

/**
 * The desk rides in the same phone frame as the investor app but with its own
 * chrome: no tab bar, and a route back to the app. Access is gated here so
 * every child route inherits the check; the real boundary is the
 * `vanta_admin_guard()` inside each RPC.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSessionAdmin())) {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    redirect("/dashboard");
  }

  return (
    <PhoneShell
      top={
        <header className="sticky top-0 z-40 border-b border-gold/15 bg-navy-950/85 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5">
            <Link href="/admin" className="flex items-center gap-2">
              <VantaMark className="h-7 w-auto" />
              <span className="font-display text-[14px] leading-none font-bold">
                <span className="text-steel-gradient">VANTA</span>{" "}
                <span className="text-gold-gradient">OPS DESK</span>
              </span>
            </Link>
            <Link
              href="/dashboard"
              aria-label="Back to the app"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-electric/25 bg-electric/10 text-mist transition-colors hover:border-electric/50 hover:text-fog"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 5.5 8 12l6.5 6.5" />
              </svg>
            </Link>
          </div>
        </header>
      }
    >
      <main className="min-h-full">{children}</main>
    </PhoneShell>
  );
}
