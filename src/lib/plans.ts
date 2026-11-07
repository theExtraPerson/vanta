/**
 * The five VANTAFINTECH AI Technology long-term products, exactly as published
 * in the official product broadcast.
 *
 *   PRODUCT      | PRICE      | DAILY EARNING | DAYS | EARNINGS | PAYOUT AT MATURITY
 *   VANTA Core   | UGX 20,000 | UGX 3,000     | 3    | 9,000    | UGX 29,000
 *   VANTA Nova   | UGX 50,000 | UGX 9,000     | 4    | 36,000   | UGX 86,000
 *   VANTA Pulse  | UGX 150,000| UGX 20,000    | 5    | 100,000  | UGX 250,000
 *   VANTA max    | UGX 200,000| UGX 30,000    | 6    | 180,000  | UGX 380,000
 *   VANTAgold    | UGX 500,000| UGX 80,000    | 7    | 560,000  | UGX 1,060,000
 */

export type Plan = {
  slug: string;
  name: string;
  amount: number;
  daily: number;
  days: number;
  /** daily * days */
  totalEarnings: number;
  /** amount + totalEarnings — paid out on the maturity day */
  totalReturn: number;
  /** totalEarnings / amount, as a percentage */
  roi: number;
  badge?: string;
  summary: string;
  perks: string[];
};

const raw = [
  {
    slug: "core",
    name: "VANTA Core",
    amount: 20_000,
    daily: 3_000,
    days: 3,
    badge: "Entry",
    summary: "Earn 3,000 daily and 29,000 after 3 days.",
    perks: ["3-day cycle", "Entry product", "Referral eligible"],
  },
  {
    slug: "nova",
    name: "VANTA Nova",
    amount: 50_000,
    daily: 9_000,
    days: 4,
    summary: "Earn 9,000 daily and 86,000 after 4 days.",
    perks: ["4-day cycle", "Reinvest rewards", "Referral eligible"],
  },
  {
    slug: "pulse",
    name: "VANTA Pulse",
    amount: 150_000,
    daily: 20_000,
    days: 5,
    badge: "Most popular",
    summary: "Earn 20,000 daily and 250,000 after 5 days.",
    perks: ["5-day cycle", "Priority payout queue", "Referral eligible"],
  },
  {
    slug: "max",
    name: "VANTA max",
    amount: 200_000,
    daily: 30_000,
    days: 6,
    summary: "Earn 30,000 daily and 380,000 after 6 days.",
    perks: ["6-day cycle", "Priority payout queue", "Referral eligible"],
  },
  {
    slug: "gold",
    name: "VANTAgold",
    amount: 500_000,
    daily: 80_000,
    days: 7,
    badge: "Highest return",
    summary: "Earn 80,000 daily and 1,060,000 after 7 days.",
    perks: ["7-day cycle", "Concierge settlement", "Referral eligible"],
  },
] as const;

export const plans: Plan[] = raw.map((p) => {
  const totalEarnings = p.daily * p.days;
  const totalReturn = p.amount + totalEarnings;
  return {
    ...p,
    perks: [...p.perks],
    totalEarnings,
    totalReturn,
    roi: Math.round((totalEarnings / p.amount) * 100),
  };
});

export const planBySlug = (slug: string) => plans.find((p) => p.slug === slug);

/** The product the marketing site highlights as the recommended cycle. */
export const featuredPlan = planBySlug("pulse") ?? plans[0];

export const minPlanAmount = Math.min(...plans.map((p) => p.amount));
export const maxPlanAmount = Math.max(...plans.map((p) => p.amount));