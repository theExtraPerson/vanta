import type { Metadata } from "next";
import { getDashboard } from "@/lib/data";
import { PlanGrid } from "@/components/dashboard/forms";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { ugx } from "@/lib/format";

export const metadata: Metadata = {
  title: "Plans",
  description: "Activate a VANTAFINTECH long-term plan.",
};

export default async function PlansPage() {
  const data = await getDashboard();
  if (!data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        back={null}
        title="Plans"
        subtitle="Pick a plan, activate it from your wallet and the daily earning starts the next cycle."
        right={
          <span className="rounded-full border border-gold/28 bg-gold/8 px-2.5 py-1 font-display text-[10.5px] font-bold text-gold">
            {ugx(data.wallet.balance)}
          </span>
        }
      />

      <div className="space-y-4 px-4 pt-1">
        <PlanGrid balance={data.wallet.balance} />

        <p className="rounded-xl border border-electric/10 bg-navy-900/50 px-3 py-2.5 text-[10.5px] leading-relaxed text-slate-deep">
          Prices, daily earnings and maturity payouts are fixed per plan. Capital is released
          together with the final daily earning on the maturity day.
        </p>
      </div>
    </div>
  );
}