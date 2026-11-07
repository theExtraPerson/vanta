import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "gold" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "btn focus-visible:outline-none disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  gold: "btn-gold",
  outline: "btn-outline",
  ghost: "btn-ghost",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[11px]",
  md: "h-11 px-6 text-[11.5px]",
  lg: "h-13 px-7 text-[12.5px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

const pillTones = {
  cyan: "border-electric/25 bg-electric/8 text-electric",
  purple: "border-royal/30 bg-royal/12 text-royal-light",
  gold: "border-gold/30 bg-gold/8 text-gold",
  green: "border-mint/28 bg-mint/10 text-mint",
  red: "border-[#ff7070]/28 bg-[#ff7070]/10 text-[#ff8f8f]",
  muted: "border-slate-deep/25 bg-white/4 text-mist",
} as const;

export function Pill({
  children,
  tone = "cyan",
  className = "",
}: {
  children: ReactNode;
  tone?: "cyan" | "purple" | "gold" | "green" | "red" | "muted";
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-display text-[10px] font-bold tracking-[0.12em] uppercase ${pillTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p className="mb-3 font-display text-[11px] font-bold tracking-[0.34em] text-electric uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="text-[30px] leading-[1.08] font-bold text-white sm:text-4xl md:text-[42px]">
        {title}
      </h2>
      {body && <p className="mt-4 text-[15px] leading-relaxed text-mist">{body}</p>}
    </div>
  );
}

export function GoldRule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-px w-full bg-gradient-to-r from-transparent via-gold/45 to-transparent ${className}`}
    />
  );
}

export function CyanRule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-px w-full bg-gradient-to-r from-transparent via-electric/45 to-transparent ${className}`}
    />
  );
}
