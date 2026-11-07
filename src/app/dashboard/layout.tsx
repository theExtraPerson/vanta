import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppBar } from "@/components/shell/AppBar";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { TabBar } from "@/components/shell/TabBar";
import { FloatingTelegram } from "@/components/shell/FloatingTelegram";
import { LedgerNotice } from "@/components/dashboard/LedgerNotice";
import { getDashboard } from "@/lib/data";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Track your Vanta Fintech wallet, active cycles, referrals and transactions.",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const data = await getDashboard();

  if (!data) {
    // Distinguish "not signed in" from "signed in but the ledger RPC is not
    // there yet". Only the first case may send the visitor back to /login —
    // otherwise a freshly signed-in user is bounced straight back to the sign
    // page by the redirect loop.
    const user = await getSessionUser();
    if (!user) redirect("/login");

    return (
      <PhoneShell
        top={<AppBar fullName={user.fullName} balance={0} />}
        bottom={<TabBar />}
      >
        <LedgerNotice />
        <FloatingTelegram />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell
      top={<AppBar fullName={data.profile.full_name} balance={data.wallet.balance} />}
      bottom={<TabBar />}
    >
      <main className="min-h-full pb-2">{children}</main>
      <FloatingTelegram />
    </PhoneShell>
  );
}
