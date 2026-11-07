import Link from "next/link";
import { VantaMark } from "@/components/brand/VantaMark";
import { initialsOf, ugx } from "@/lib/format";

export function AppBar({
  fullName,
  balance,
}: {
  fullName: string;
  balance: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-electric/12 bg-navy-950/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <VantaMark className="h-7 w-auto" />
          <span className="font-display text-[14px] leading-none font-bold">
            <span className="text-steel-gradient">VANTA</span>{" "}
            <span className="text-gold-gradient">FINTECH</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gold/28 bg-gold/8 px-2.5 py-1 font-display text-[10.5px] font-bold tracking-[0.06em] text-gold">
            {ugx(balance)}
          </span>
          <Link
            href="/dashboard/settings"
            aria-label="Account"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-electric/25 bg-electric/10 font-display text-[10.5px] font-bold text-electric"
          >
            {initialsOf(fullName)}
          </Link>
        </div>
      </div>
    </header>
  );
}