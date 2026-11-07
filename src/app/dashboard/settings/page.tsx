import type { Metadata } from "next";
import Link from "next/link";
import { getDashboard } from "@/lib/data";
import { ProfileForm } from "@/components/dashboard/forms";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { Pill } from "@/components/ui/primitives";
import { signOutAction } from "@/lib/actions";
import { isSessionAdmin } from "@/lib/admin/data";
import { brand } from "@/lib/brand";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Account" };

export default async function SettingsPage() {
  const data = await getDashboard();
  if (!data) return null;
  const admin = await isSessionAdmin();

  return (
    <div className="pb-8">
      <ScreenHeader back={null} title="Account" subtitle="Your details, security and support desk." />

      <div className="space-y-4 px-4 pt-1">
        <section className="surface rounded-2xl p-4">
          <h2 className="mb-3 font-display text-[13px] font-bold text-white">Profile</h2>
          <ProfileForm
            fullName={data.profile.full_name}
            phone={data.profile.phone}
            username={data.profile.username}
          />
        </section>

        <section className="surface rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[13px] font-bold text-white">Account</h2>
            {admin && (
              <Link
                href="/admin"
                className="btn btn-gold h-7 shrink-0 px-2.5 text-[9.5px]"
              >
                Admin
              </Link>
            )}
          </div>
          <dl className="mt-2.5 space-y-2 text-[11.5px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-deep">Username</dt>
              <dd className="font-mono text-[11px] text-fog">{data.profile.username ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-deep">Mobile number</dt>
              <dd className="font-mono text-[11px] text-fog">{data.profile.phone ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-deep">Referral code</dt>
              <dd className="font-mono text-[11px] tracking-[0.12em] text-gold">
                {data.profile.referral_code}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-deep">Member since</dt>
              <dd className="text-fog">{shortDate(data.profile.created_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-deep">KYC</dt>
              <dd>
                <Pill tone="gold">Not submitted</Pill>
              </dd>
            </div>
          </dl>
        </section>

        <section className="surface rounded-2xl p-4">
          <h2 className="font-display text-[13px] font-bold text-white">Security</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-mist">
            <li>· Withdrawals are paid to the number registered on this account.</li>
            <li>· Sessions expire automatically — sign in again on a new device.</li>
            <li>· Row-level security limits every query to your own records.</li>
          </ul>
        </section>

        <section className="surface rounded-2xl p-4">
          <h2 className="font-display text-[13px] font-bold text-white">Support</h2>
          <p className="mt-2 text-[11.5px] leading-relaxed text-mist">
            Customer service {brand.supportHandle} · Telegram {brand.community.replace("https://", "")}
            <br />
            {brand.supportEmail} · {brand.address}
          </p>
          <Link
            href="/"
            className="mt-3 inline-block font-display text-[10.5px] font-semibold tracking-[0.08em] text-electric uppercase hover:underline"
          >
            Public site →
          </Link>
        </section>

        <form action={signOutAction}>
          <button
            type="submit"
            className="btn btn-outline h-11 w-full text-[11px]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}