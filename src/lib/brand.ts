/**
 * Vanta Fintech — single source of truth for brand + business rules.
 * Values come from the brand assets: logo.jpg, ogg.jpg, products.jpg,
 * referral_program.jpg.
 */

export const brand = {
  name: "Vanta Fintech",
  shortName: "Vanta",
  tagline: "AI Technology",
  platformLabel: "Long-Term Platform",
  subTagline: "Invest Smartly · Earn Consistently · Grow Your Wealth",
  groupLabel: "VANTAFINTECH AI Technology",
  invitation: "Join VANTAFINTECH Today and Enjoy Unlimited Opportunities!",
  legalName: "Vanta Fintech Group Ltd",
  currency: "UGX",
  locale: "en-UG",
  domain: "vantatech.online",
  registerUrl: "https://www.vantatech.online",
  supportHandle: "@Micron",
  supportTelegram: "https://t.me/Micron",
  supportEmail: "support@vantatech.online",
  supportPhone: "+256 700 000 000",
  address: "Kampala, Uganda",
  community: "https://t.me/M",
  socials: {
    x: "https://x.com",
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    telegram: "https://t.me/M",
    whatsapp: "https://whatsapp.com",
  },
} as const;

/** Referral programme taken from referral_program.jpg */
export const referral = {
  levels: [
    {
      level: 1,
      rate: 0.17,
      label: "1st Level",
      headline: "17%",
      blurb: "Earn 17% commission on every investment made by the people you invite directly.",
    },
    {
      level: 2,
      rate: 0.01,
      label: "2nd Level",
      headline: "1%",
      blurb: "Earn 1% commission on every investment made by the people your invitees bring in.",
    },
  ],
  steps: [
    {
      title: "Invite Your Friends",
      detail: "Share your referral link — the code is filled in automatically at sign-up.",
    },
    { title: "Earn Commission", detail: "Get credited the moment your invitee activates a plan." },
    { title: "Grow Your Earnings", detail: "Build a second level and keep earning on every cycle." },
  ],
  claim: "Together We Grow with Vanta Fintech!",
} as const;

export type ReferralLevel = (typeof referral.levels)[number];

/** Trust markers shown on the marketing site. */
export const highlights = [
  {
    title: "Invest Smartly",
    body: "Five fixed-return plans with transparent daily payouts — no hidden fees, no lock-in surprises.",
  },
  {
    title: "Earn Consistently",
    body: "Earnings accrue every single day of your cycle and land straight in your Vanta wallet.",
  },
  {
    title: "Grow Your Wealth",
    body: "Reinvest your returns or withdraw to mobile money — the choice stays entirely yours.",
  },
] as const;

export const stats = [
  { value: "24,800+", label: "Active investors" },
  { value: "UGX 8.4B", label: "Earnings disbursed" },
  { value: "99.98%", label: "Ledger uptime" },
  { value: "5", label: "Long-term plans" },
] as const;

export const steps = [
  {
    step: "01",
    title: "Create your account",
    body: "Sign up in under a minute with your name and phone number. Your wallet is created instantly.",
  },
  {
    step: "02",
    title: "Fund your wallet",
    body: "Deposit with MTN MoMo, Airtel Money or a bank transfer. Confirm with the transaction reference.",
  },
  {
    step: "03",
    title: "Activate a plan",
    body: "Pick one of the five VINTA plans. Your daily earning starts the next cycle.",
  },
  {
    step: "04",
    title: "Earn & withdraw",
    body: "Watch daily earnings accumulate, then withdraw to mobile money once your cycle completes.",
  },
] as const;

export const features = [
  {
    title: "Daily accrual engine",
    body: "Each plan credits its daily earning to your wallet automatically, every day of the cycle.",
    icon: "clock",
  },
  {
    title: "Mobile money first",
    body: "MTN MoMo, Airtel Money and bank settlement — the rails people in Uganda already use.",
    icon: "phone",
  },
  {
    title: "Transparent ledger",
    body: "Every credit and debit is written to an auditable transaction ledger you can export any time.",
    icon: "ledger",
  },
  {
    title: "Two-level referrals",
    body: "17% on your first level and 1% on your second, credited the moment an invitee invests.",
    icon: "network",
  },
  {
    title: "Bank-grade security",
    body: "Row-level security on every table. Your data is only ever readable by your own session.",
    icon: "shield",
  },
  {
    title: "Human support",
    body: "A real desk on WhatsApp and email, seven days a week, in English and Luganda.",
    icon: "chat",
  },
] as const;

export const testimonials = [
  {
    name: "Brian Ochieng",
    role: "Boda operator · Kampala",
    quote:
      "I started with the 20,000 product to test it. Three days later my 29,000 was in my MoMo wallet. Now I run the 150,000 one.",
    initials: "BO",
  },
  {
    name: "Sarah Nakato",
    role: "Shop owner · Entebbe",
    quote:
      "The referral link is what changed things for me. My first level brings in more than my shop on a good week.",
    initials: "SN",
  },
  {
    name: "Daniel Mugisha",
    role: "Teacher · Mbarara",
    quote:
      "What I like is that the numbers are written down before you invest. Duration, daily earning, total — all visible.",
    initials: "DM",
  },
] as const;

export const faqs = [
  {
    q: "How do the VINTA plans work?",
    a: "Each plan is a fixed long-term cycle. You activate it once, Vanta credits the stated daily earning to your wallet for the stated number of days, and on the maturity day your capital is returned together with the total earnings shown on the plan card.",
  },
  {
    q: "What is the minimum amount I can start with?",
    a: "VINTA Core is UGX 20,000 — it pays UGX 3,000 daily for 3 days, so you receive UGX 29,000 after 3 days. The largest plan is VINTAgold at UGX 500,000, paying UGX 80,000 daily and UGX 1,060,000 after 7 days.",
  },
  {
    q: "How fast are withdrawals processed?",
    a: "Withdrawal requests are queued to the payout desk as soon as you submit them. Mobile money settlements typically clear within the same working day; bank transfers can take up to 24 hours.",
  },
  {
    q: "How does the referral programme pay?",
    a: "You earn 17% of the investment amount of anyone you invite directly (1st level) and 1% of anyone your invitees bring in (2nd level). Commission is credited to your wallet the moment your invitee activates a product.",
  },
  {
    q: "Can I run more than one plan at a time?",
    a: "Yes. Plans run independently, so you can hold several active cycles at once and stack their daily earnings.",
  },
  {
    q: "What happens at the end of a cycle?",
    a: "Your capital plus the total earnings for that cycle are released to your Vanta wallet. From there you can withdraw or re-activate a plan.",
  },
] as const;

export const navLinks = [
  { href: "/#plans", label: "Plans" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#referrals", label: "Referrals" },
  { href: "/#faq", label: "FAQ" },
] as const;
