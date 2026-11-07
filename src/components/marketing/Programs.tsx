import { ButtonLink, Pill } from "@/components/ui/primitives";
import { ReferralLinkBox } from "./ReferralLinkBox";
import { brand, faqs, features, highlights, referral, steps, testimonials } from "@/lib/brand";
import { plans } from "@/lib/plans";
import { siteUrl } from "@/lib/supabase/config";
import { ugx } from "@/lib/format";

const icons: Record<string, React.ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  ledger: (
    <>
      <path d="M5 4.5h11l3 3v12H5z" />
      <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </>
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="5.5" cy="18" r="2.4" />
      <circle cx="18.5" cy="18" r="2.4" />
      <path d="M12 7.4v4.2M10.2 12.8L7 15.8M13.8 12.8l3.2 3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.4-3 7.6-7 9.5-4-1.9-7-5.1-7-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5.5h16v10H9.5L5 19.5z" />
      <path d="M8.5 10h7" />
    </>
  ),
};

function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
}) {
  return (
    <div>
      <p className="micro-label">{eyebrow}</p>
      <h2 className="mt-1.5 font-display text-[22px] leading-tight font-bold text-white">{title}</h2>
      {body && <p className="mt-2 text-[12px] leading-relaxed text-mist">{body}</p>}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-20 px-4 py-10">
      <SectionTitle
        eyebrow="How it works"
        title={
          <>
            Sign-up to payout in <span className="text-qx-gradient">four steps</span>
          </>
        }
        body="No trading screens, no charts to interpret. You choose a plan, Vanta runs it, and the earnings land in your wallet."
      />

      <ol className="mt-5 space-y-2.5">
        {steps.map((s) => (
          <li key={s.step} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-electric/30 bg-gradient-to-b from-electric/12 to-navy-800 font-display text-[13px] font-bold text-electric">
              {s.step}
            </span>
            <div className="pt-0.5">
              <h3 className="font-display text-[13.5px] font-bold text-white">{s.title}</h3>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 space-y-2.5">
        {highlights.map((h) => (
          <div key={h.title} className="surface rounded-2xl p-3.5">
            <h3 className="font-display text-[12.5px] font-bold text-electric">{h.title}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-mist">{h.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReferralProgram() {
  return (
    <section id="referrals" className="relative scroll-mt-20 overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(124,77,255,0.18),transparent_70%)]" />

      <div className="relative">
        <SectionTitle
          eyebrow="Referral programme"
          title={
            <>
              Invite friends. <span className="text-qx-gradient">Earn big.</span>
            </>
          }
          body="Commission lands in your wallet the moment an invitee activates a plan. No cap, no waiting period."
        />

        <div className="mt-4 space-y-3">
          {referral.levels.map((lvl, i) => (
            <div
              key={lvl.level}
              className={`qx-card relative overflow-hidden bg-gradient-to-br p-4 ${
                i === 0
                  ? "border-[#ff7070]/30 from-[#3a0d14] via-[#250c16] to-[#120912]"
                  : "border-royal/40 from-[#160f34] via-[#0e1230] to-[#080b1e]"
              }`}
            >
              <div className="pointer-events-none absolute -top-14 -right-8 h-40 w-40 rounded-full bg-gold/15 blur-[60px]" />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-[9px] font-bold tracking-[0.26em] text-white/55 uppercase">
                    {lvl.label}
                  </p>
                  <p
                    className={`mt-1 font-display text-[42px] leading-none font-bold tracking-tighter ${
                      i === 0 ? "text-gold-gradient" : "text-qx-gradient"
                    }`}
                  >
                    {lvl.headline}
                  </p>
                </div>
                <p className="max-w-[11rem] text-[10.5px] leading-relaxed text-white/75">
                  {lvl.blurb}
                </p>
              </div>
              <p className="relative mt-2 font-display text-[10px] font-bold tracking-[0.14em] text-electric uppercase">
                Example: {ugx(50_000)} → {ugx(50_000 * lvl.rate)}
              </p>
            </div>
          ))}
        </div>

        <ol className="mt-4 space-y-2">
          {referral.steps.map((s, i) => (
            <li key={s.title} className="surface flex items-start gap-2.5 rounded-xl p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-electric/30 bg-electric/8 font-display text-[11px] font-bold text-electric">
                {i + 1}
              </span>
              <div>
                <p className="font-display text-[12.5px] font-bold text-white">{s.title}</p>
                <p className="text-[11px] text-mist">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2.5 font-display text-[11.5px] font-bold text-gold-light">
          {referral.claim}
        </p>

        <div className="mt-4">
          <ReferralLinkBox
            code="V7K2Q9"
            link={`${siteUrl}/register?code=V7K2Q9`}
            note="Sample invite link — your own code is issued when you register."
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-mist">
          12 people on your first level investing {ugx(150_000)} each earns you{" "}
          <span className="font-semibold text-gold">{ugx(12 * 150_000 * 0.17)}</span>. Their 37
          invitees at the same ticket add{" "}
          <span className="font-semibold text-royal-light">{ugx(37 * 150_000 * 0.01)}</span>.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="gold">17% level 1</Pill>
          <Pill tone="cyan">1% level 2</Pill>
          <Pill tone="muted">No cap</Pill>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="relative px-4 py-10">
      <SectionTitle
        eyebrow="Why Vanta"
        title={
          <>
            Built like a bank ledger,{" "}
            <span className="text-qx-gradient">priced like a product</span>
          </>
        }
        body="Every movement of money on Vanta is written to an immutable record. You always know what came in, what went out and what is still running."
      />

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {features.map((f) => (
          <div key={f.title} className="surface rounded-2xl p-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-electric/22 bg-electric/[0.07] text-electric">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {icons[f.icon]}
              </svg>
            </span>
            <h3 className="mt-2.5 font-display text-[12px] font-bold text-white">{f.title}</h3>
            <p className="mt-1 text-[10.5px] leading-relaxed text-mist">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <ButtonLink href="/register" variant="primary" size="md" className="w-full">
          Create an account
        </ButtonLink>
        <ButtonLink href="/login" variant="outline" size="md" className="w-full">
          I already have an account
        </ButtonLink>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="relative overflow-hidden py-10">
      <div className="px-4">
        <SectionTitle
          eyebrow="Investor stories"
          title={
            <>
              People already running <span className="text-qx-gradient">their plan</span>
            </>
          }
        />
      </div>

      <div className="-mx-0 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {testimonials.map((t) => (
          <figure
            key={t.name}
            className="surface w-[16rem] shrink-0 snap-start rounded-2xl p-4"
          >
            <div className="flex gap-0.5 text-gold" aria-label="5 out of 5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} viewBox="0 0 20 20" className="h-3 w-3 fill-current">
                  <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
                </svg>
              ))}
            </div>
            <blockquote className="mt-2.5 text-[11.5px] leading-relaxed text-fog/85">
              “{t.quote}”
            </blockquote>
            <figcaption className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-electric/25 bg-electric/10 font-display text-[10px] font-bold text-electric">
                {t.initials}
              </span>
              <span>
                <span className="block font-display text-[11.5px] font-bold text-white">
                  {t.name}
                </span>
                <span className="block text-[10px] text-slate-deep">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="relative scroll-mt-20 px-4 py-10">
      <SectionTitle
        eyebrow="FAQ"
        title={
          <>
            Questions, <span className="text-qx-gradient">answered plainly</span>
          </>
        }
      />

      <div className="mt-4 divide-y divide-white/8 overflow-hidden rounded-2xl border border-electric/12 bg-navy-900/60">
        {faqs.map((f, i) => (
          <details key={f.q} className="group px-4 py-0.5" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 font-display text-[12.5px] font-semibold text-white [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-electric/30 text-electric transition-transform group-open:rotate-45">
                <span className="absolute h-[1.5px] w-2 bg-current" />
                <span className="absolute h-2 w-[1.5px] bg-current" />
              </span>
            </summary>
            <p className="pb-3.5 text-[11.5px] leading-relaxed text-mist">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative px-4 pt-4 pb-10">
      <div className="qx-card relative px-4 py-7 text-center">
        <div className="pointer-events-none absolute inset-0 grid-texture opacity-70" />
        <div className="pointer-events-none absolute -top-20 left-1/2 h-52 w-[26rem] -translate-x-1/2 rounded-full bg-royal/18 blur-[90px]" />

        <div className="relative">
          <p className="font-display text-[9px] font-bold tracking-[0.28em] text-electric uppercase">
            {brand.subTagline}
          </p>
          <h2 className="mt-3 font-display text-[21px] leading-tight font-bold text-white">
            {brand.invitation}
          </h2>
          <p className="mt-2 text-[11.5px] leading-relaxed text-mist">
            Open your account, fund with mobile money, and activate a plan from {ugx(plans[0].amount)}{" "}
            — about four minutes end to end.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <ButtonLink href="/register" variant="primary" size="md" className="w-full">
              Create account
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="md" className="w-full">
              Sign in
            </ButtonLink>
          </div>

          <p className="mt-5 border-t border-electric/10 pt-3 text-[10px] leading-relaxed text-slate-deep">
            {brand.legalName} · {brand.address}
            <br />
            Customer service {brand.supportHandle} · {brand.supportEmail}
          </p>
        </div>
      </div>
    </section>
  );
}