import type { Metadata } from "next";
import { getDashboard } from "@/lib/data";
import { ReferralLinkBox } from "@/components/marketing/ReferralLinkBox";
import { StatCard } from "@/components/dashboard/widgets";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { Pill } from "@/components/ui/primitives";
import { referral } from "@/lib/brand";
import { shortDate, ugx } from "@/lib/format";

export const metadata: Metadata = { title: "Team" };

export default async function ReferralsPage() {
  const data = await getDashboard();
  if (!data) return null;

  const groups = [
    { title: "1st level · 17%", rows: data.referrals.rows.filter((r) => r.level === 1), tone: "gold" as const },
    { title: "2nd level · 1%", rows: data.referrals.rows.filter((r) => r.level === 2), tone: "purple" as const },
  ];

  return (
    <div className="pb-8">
      <ScreenHeader
        back={null}
        title="My team"
        subtitle={`Earn ${referral.levels[0].headline} on your direct invites and ${referral.levels[1].headline} on everyone they invite.`}
      />

      <div className="space-y-4 px-4 pt-1">
        <ReferralLinkBox code={data.referrals.code} link={data.referrals.link} />

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Level 1 partners"
            value={String(data.referrals.level1_count)}
            sub="Direct invites"
            accent="gold"
          />
          <StatCard
            label="Level 2 partners"
            value={String(data.referrals.level2_count)}
            sub="Second level"
            accent="cyan"
          />
          <StatCard
            label="17% earned"
            value={ugx(data.referrals.level1_earned)}
            sub="First level"
            accent="gold"
          />
          <StatCard
            label="1% earned"
            value={ugx(data.referrals.level2_earned)}
            sub="Second level"
            accent="green"
          />
        </div>

        <section className="surface rounded-2xl p-4">
          <h2 className="font-display text-[13px] font-bold text-white">How commission is credited</h2>
          <ol className="mt-2.5 space-y-2">
            {referral.steps.map((s, i) => (
              <li key={s.title} className="flex gap-2.5 text-[11.5px]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-electric/30 bg-electric/8 font-display text-[9.5px] font-bold text-electric">
                  {i + 1}
                </span>
                <span>
                  <span className="font-semibold text-fog">{s.title}</span>
                  <span className="block text-[10.5px] text-slate-deep">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {groups.map((group) => (
          <section key={group.title} className="surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-electric/10 px-4 py-2.5">
              <h2 className="font-display text-[12px] font-bold tracking-[0.1em] text-white uppercase">
                {group.title}
              </h2>
              <Pill tone={group.tone}>{group.rows.length}</Pill>
            </div>

            {group.rows.length ? (
              <ul>
                {group.rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-fog">{r.full_name}</p>
                      <p className="text-[10px] text-slate-deep">
                        {shortDate(r.joined_at)} · invested {r.invested ? ugx(r.invested) : "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-[12px] font-bold text-gold">
                        {r.commission ? ugx(r.commission) : "—"}
                      </p>
                      <Pill tone={r.status === "active" ? "green" : "muted"}>{r.status}</Pill>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-[11px] text-slate-deep">
                No partners on this level yet — share your link to start the line.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}