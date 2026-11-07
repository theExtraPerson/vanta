"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/plans", label: "Plans", icon: "layers" },
  { href: "/dashboard/wallet", label: "Wallet", icon: "wallet" },
  { href: "/dashboard/referrals", label: "Team", icon: "team" },
  { href: "/dashboard/settings", label: "Account", icon: "user" },
] as const;

const paths: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
      <path d="M3.5 12.5 12 17l8.5-4.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.4" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.1" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c.6-3.1 2.8-4.8 5.5-4.8s4.9 1.7 5.5 4.8" />
      <path d="M16 5.6a3 3 0 0 1 0 5.6M17.4 15c2.1.4 3.4 2 3.8 4.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.4" />
      <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
    </>
  ),
};

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App"
      className="sticky bottom-0 z-40 border-t border-electric/12 bg-navy-950/95 backdrop-blur-xl"
    >
      <ul className="grid grid-cols-5 px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          const active =
            tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
                  active ? "text-electric" : "text-slate-deep hover:text-mist"
                }`}
              >
                <span
                  className={`absolute -top-1.5 h-[2px] w-6 rounded-full transition-opacity ${
                    active ? "bg-electric opacity-100" : "opacity-0"
                  }`}
                />
                <svg
                  viewBox="0 0 24 24"
                  className="h-[19px] w-[19px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {paths[tab.icon]}
                </svg>
                <span className="font-display text-[9px] font-bold tracking-[0.12em] uppercase">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}