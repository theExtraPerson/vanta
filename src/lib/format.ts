const nf0 = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-UG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 20000 -> "20,000" */
export function num(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return nf0.format(Math.round(value));
}

/** 20000 -> "UGX 20,000" */
export function ugx(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && Math.abs(value) >= 1_000_000) {
    return `UGX ${nf2.format(value / 1_000_000)}M`;
  }
  if (opts?.compact && Math.abs(value) >= 10_000) {
    return `UGX ${nf0.format(Math.round(value / 1000))}K`;
  }
  return `UGX ${num(value)}`;
}

/** 0.17 -> "17%" */
export function pct(rate: number, digits = 0): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

/**
 * USD price for the market widgets. Keeps small-cap precision without ever
 * printing "$0.00": >=10k drops decimals, >=100 pairs, >=1 four places,
 * anything smaller goes to four significant digits.
 */
export function usd(value: number): string {
  if (!Number.isFinite(value)) return "$—";
  const abs = Math.abs(value);
  if (abs >= 10_000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (abs >= 100) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (abs >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

/**
 * Signed percentage. The reference platform rendered falling coins as
 * "▼ 0.36%", which reads like a missing minus sign - keep the sign explicit.
 */
export function signedPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value).toFixed(digits);
  return `${value >= 0 ? "+" : "−"}${abs}%`;
}

export function shortDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/** ISO instant → "22:00" on the platform clock (Uganda by default). */
export function clockTime(
  input: string | Date | null | undefined,
  timeZone = "Africa/Kampala",
): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function daysLeft(endsAt: string | Date | null | undefined): number {
  if (!endsAt) return 0;
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  const diff = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "VF";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("Clipboard unavailable"));
}
