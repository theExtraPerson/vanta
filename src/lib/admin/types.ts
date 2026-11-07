import type { PaymentRules, TransactionRow } from "@/lib/types";

/**
 * Shapes returned by the admin RPCs in supabase/admin.sql. Kept separate from
 * the investor-facing types so the admin surface can evolve independently.
 */

export type AdminOverview = {
  members_total: number;
  members_today: number;
  members_yesterday: number;
  active_members: number;
  banned_members: number;
  deposits_in_flight: number;
  withdrawals_waiting: number;
  deposits_received: number;
  withdrawals_paid: number;
  fees_collected: number;
  returns_paid: number;
  commission_paid: number;
  wallet_liability: number;
  active_cycles: number;
};

export type AdminMember = {
  id: string;
  full_name: string;
  username: string | null;
  phone: string | null;
  referral_code: string;
  balance: number;
  total_invested: number;
  total_earned: number;
  referral_earned: number;
  is_banned: boolean;
  created_at: string;
  referrals_count: number;
  active_cycles: number;
  first_deposit_at: string | null;
};

export type AdminDeposit = {
  id: string;
  user_id: string;
  name: string;
  username: string | null;
  amount: number;
  method: string;
  msisdn: string | null;
  network: string | null;
  charge: number | null;
  net_amount: number | null;
  status: string;
  reference: string;
  tid: string | null;
  failure_message: string | null;
  created_at: string;
  settled_at: string | null;
};

export type AdminWithdrawal = {
  id: string;
  user_id: string;
  name: string;
  username: string | null;
  amount: number;
  method: string;
  msisdn: string | null;
  network: string | null;
  charge: number | null;
  net_amount: number | null;
  status: string;
  reference: string;
  tid: string | null;
  failure_message: string | null;
  created_at: string;
  settled_at: string | null;
};

export type AdminReferralRow = {
  id: string;
  level: number;
  rate: number;
  amount: number;
  created_at: string;
  beneficiary: string;
  beneficiary_username: string | null;
  source: string;
  source_username: string | null;
};

export type AdminCycle = {
  id: string;
  user_id: string;
  name: string;
  username: string | null;
  plan_name: string;
  amount: number;
  daily_return: number;
  duration_days: number;
  days_paid: number;
  total_return: number;
  status: "active" | "completed";
  started_at: string;
  ends_at: string;
};

export type AdminPlan = {
  slug: string;
  name: string;
  amount: number;
  daily_return: number;
  duration_days: number;
  badge: string | null;
  is_active: boolean;
  sort_order: number;
  active_count: number;
};

export type AdminRoster = {
  id: string;
  name: string;
  username: string | null;
  created_at: string;
  is_self: boolean;
};

export type AdminAuditRow = {
  id: string;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  note: string | null;
  created_at: string;
};

export type AdminDashboard = {
  actor: { id: string };
  overview: AdminOverview;
  members: AdminMember[];
  deposits: AdminDeposit[];
  withdrawals: AdminWithdrawal[];
  referrals: {
    level1_paid: number;
    level2_paid: number;
    invested_members: number;
    rows: AdminReferralRow[];
  };
  cycles: AdminCycle[];
  plans: AdminPlan[];
  admins: AdminRoster[];
  audit: AdminAuditRow[];
  settings: Record<string, unknown>;
  rules: PaymentRules;
};

export type AdminMemberDetail = {
  profile: {
    id: string;
    full_name: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    referral_code: string;
    balance: number;
    total_invested: number;
    total_earned: number;
    referral_earned: number;
    is_banned: boolean;
    created_at: string;
    referred_by_name: string | null;
    referred_by_code: string | null;
  };
  cycles: {
    id: string;
    plan_name: string;
    amount: number;
    daily_return: number;
    duration_days: number;
    days_paid: number;
    status: string;
    started_at: string;
    ends_at: string;
  }[];
  ledger: TransactionRow[];
  downline: {
    id: string;
    full_name: string;
    referral_code: string;
    created_at: string;
    invested: number;
  }[];
};
