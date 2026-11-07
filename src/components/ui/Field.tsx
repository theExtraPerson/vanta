import type { InputHTMLAttributes } from "react";

const fieldBase =
  "h-11 w-full rounded-xl border border-electric/15 bg-navy-900/70 px-3.5 text-[14px] text-fog placeholder:text-slate-deep/70 transition-colors focus:border-electric/55 focus:bg-navy-900 focus:outline-none focus:ring-2 focus:ring-electric/15";

export function Field({
  label,
  hint,
  error,
  suffix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  suffix?: string;
}) {
  const id = props.id ?? props.name;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between font-display text-[10.5px] font-bold tracking-[0.14em] text-mist uppercase"
      >
        {label}
        {hint && (
          <span className="text-[10px] font-medium tracking-normal text-slate-deep normal-case">
            {hint}
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          aria-invalid={Boolean(error)}
          className={`${fieldBase} ${error ? "border-[#ff7070]/60" : ""} ${suffix ? "pr-14" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-display text-[10px] font-bold tracking-[0.16em] text-slate-deep">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="mt-1.5 text-[11.5px] text-[#ff8f8f]">{error}</p>}
    </div>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    error: "border-[#ff7070]/30 bg-[#ff7070]/10 text-[#ff8f8f]",
    success: "border-mint/30 bg-mint/10 text-mint",
    info: "border-electric/25 bg-electric/8 text-electric",
  } as const;

  return (
    <div className={`rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}
