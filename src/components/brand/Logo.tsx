import Link from "next/link";
import { VantaMark } from "./VantaMark";

type LogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
};

const sizes = {
  sm: { mark: "h-8 w-auto", name: "text-[15px]", sub: "text-[8.5px]", gap: "gap-2" },
  md: { mark: "h-11 w-auto", name: "text-xl", sub: "text-[10.5px]", gap: "gap-2.5" },
  lg: { mark: "h-16 w-auto", name: "text-3xl", sub: "text-sm", gap: "gap-4" },
} as const;

export function Logo({ href = "/", size = "md", showTagline = false, className = "" }: LogoProps) {
  const s = sizes[size];

  const content = (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <VantaMark className={`${s.mark} shrink-0`} />
      <span className="flex flex-col leading-none">
        <span
          className={`${s.name} text-steel-gradient font-display font-extrabold tracking-[-0.02em]`}
        >
          VANTA
        </span>
        <span
          className={`${s.sub} text-gold-gradient font-display font-bold tracking-[0.34em] uppercase`}
        >
          Fintech
        </span>
        {showTagline && (
          <span className="mt-1.5 text-[10px] font-semibold tracking-[0.2em] text-gold/80 uppercase">
            Invest · Earn · Grow
          </span>
        )}
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label="Vanta Fintech home" className="group inline-flex">
      {content}
    </Link>
  );
}
