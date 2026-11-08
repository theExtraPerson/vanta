import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { parseReferralCode } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/server";
import { planBySlug } from "@/lib/plans";
import { ugx } from "@/lib/format";

const SHARE_TITLE = "Vanta Fintech — AI Technology";
const SHARE_TEXT =
  "An ecosystem that removes the barriers between the retail investor and the professional market. We guarantee the transparency of every operation and give access to capital management tools at an institutional level.";

// This is what the recipient sees when a referral link is shared — the page
// metadata feeds the link-preview card, so the pitch lives here, not on the
// root layout's generic OpenGraph block.
export const metadata: Metadata = {
  title: { absolute: SHARE_TITLE },
  description: SHARE_TEXT,
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_TEXT,
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_TEXT,
  },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; ref?: string; plan?: string }>;
}) {
  const { code, ref, plan } = await searchParams;

  // An existing session goes straight to the app instead of the sign-up form.
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  // Invite links carry ?code=XXXX — the code is pre-filled so an invited user
  // never has to type it.
  const inviteCode = parseReferralCode(code ?? ref ?? "");
  const selected = plan ? planBySlug(plan) : undefined;

  return (
    <AuthShell
      title={inviteCode ? "You were invited" : "Create your account"}
      subtitle={
        inviteCode
          ? "Your referral link is already filled in — just add your details to join."
          : "Four fields, one minute. Your wallet is created instantly."
      }
      footer={
        <p>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-electric hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <RegisterForm
        defaultRef={inviteCode}
        planLabel={
          selected
            ? `${selected.name} · ${ugx(selected.amount)} · ${ugx(selected.daily)}/day for ${selected.days} days`
            : undefined
        }
      />
    </AuthShell>
  );
}