export type TxType =
  | "deposit"
  | "investment"
  | "earning"
  | "referral"
  | "withdrawal"
  | "capital_return"
  | "registration_bonus"
  | "adjustment_credit"
  | "adjustment_debit";

export type TxStatus = "pending" | "completed" | "rejected";

export type TransactionRow = {
  id: string;
  type: TxType;
  amount: number;
  status: TxStatus;
  reference: string;
  note: string | null;
  created_at: string;
};

export type InvestmentRow = {
  id: string;
  plan_slug: string;
  plan_name: string;
  amount: number;
  daily_return: number;
  duration_days: number;
  total_return: number;
  days_paid: number;
  earned: number;
  status: "active" | "completed";
  started_at: string;
  ends_at: string;
  /** when the next daily credit unlocks (22:00 Africa/Kampala) */
  next_maturity_at?: string | null;
};

/** The rules the database publishes, so no screen hard-codes them. */
export type PaymentRules = {
  currency: string;
  timezone: string;
  min_deposit: number;
  min_withdrawal: number;
  earnings_mature_at: string;
  withdrawal_opens_at: string;
  withdrawal_closes_at: string;
  /** Percent of the gross withdrawal kept by the platform before payout. */
  withdrawal_fee_percent?: number;
  withdrawals_open: boolean;
};

export type OpenPayment = {
  id: string;
  amount: number;
  /** deposits: pending | awaiting_pin · withdrawals: pending | processing */
  status: string;
  reference: string;
  msisdn: string | null;
};

export type PaymentsSummary = {
  rules: PaymentRules;
  awaiting_deposit: OpenPayment[];
  awaiting_payout: OpenPayment[];
};

export type ReferralRow = {
  id: string;
  full_name: string;
  level: 1 | 2;
  joined_at: string;
  invested: number;
  commission: number;
  status: "active" | "pending";
};

export type DashboardData = {
  profile: {
    id: string;
    full_name: string;
    username: string | null;
    phone: string | null;
    email: string | null;
    referral_code: string;
    created_at: string;
  };
  wallet: {
    balance: number;
    total_invested: number;
    total_earned: number;
    referral_earned: number;
    pending_withdrawals: number;
    pending_deposits?: number;
    active_investments: number;
  };
  /** only present once the gateway rpc.sql has been applied */
  payments?: PaymentsSummary;
  investments: InvestmentRow[];
  transactions: TransactionRow[];
  referrals: {
    code: string;
    link: string;
    level1_count: number;
    level2_count: number;
    level1_earned: number;
    level2_earned: number;
    rows: ReferralRow[];
  };
};

/* ── Live market widgets (dashboard wire + signal board) ─────────────────── */

export type NewsTag =
  | "bitcoin"
  | "ethereum"
  | "defi"
  | "nft"
  | "regulation"
  | "market"
  | "crypto";

export type NewsItem = {
  /** stable id derived from the article URL, so React keys survive a refresh */
  id: string;
  title: string;
  /** the article itself — never a hard-coded hub page */
  url: string;
  source: string;
  image: string | null;
  tag: NewsTag;
  /** ISO instant of publication, or null when the wire omitted it */
  published_at: string | null;
  /** pre-computed on the server so hydration and the payload cannot disagree */
  age_label: string;
};

export type SignalAction = "buy" | "sell" | "neutral";

export type MarketSignal = {
  symbol: string;
  /** base asset, e.g. BTC inside BTCUSDT */
  base: string;
  /** quote asset, e.g. USDT — used only to label the pair */
  quote: string;
  name: string;
  price: number;
  change_pct_24h: number;
  high_24h: number;
  low_24h: number;
  /** where the price sits inside the 24h range, 0–100 */
  range_position: number;
  /** Wilder RSI-14 on hourly closes */
  rsi: number;
  /** EMA(9) minus EMA(21), as a percentage of price */
  ema_spread_pct: number;
  /** rate of change over the last 24 hourly closes */
  roc_pct: number;
  /** last hourly quote volume relative to its 20-bar average */
  volume_ratio: number;
  /** −100…100 composite of the four indicators */
  score: number;
  action: SignalAction;
  /** |score| mapped to 0–99 */
  strength: number;
  /** how many of the three directional indicators agree, out of 3 */
  aligned: number;
  /** overbought / oversold flag, null when the setup is clean */
  caution: string | null;
  /** polyline points for the last 24 hourly closes — real data, not a deco */
  spark: string;
  spark_up: boolean;
  updated_at: string;
};

export type MarketFeed = {
  news: NewsItem[];
  signals: MarketSignal[];
  /** epoch ms of the newest payload actually on screen */
  news_at: number | null;
  signals_at: number | null;
  /** populated when an upstream failed and the widget is showing stale data */
  news_error: string | null;
  signals_error: string | null;
};
