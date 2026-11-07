export type TxType =
  | "deposit"
  | "investment"
  | "earning"
  | "referral"
  | "withdrawal"
  | "capital_return";

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
    active_investments: number;
  };
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
