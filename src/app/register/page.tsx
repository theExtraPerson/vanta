import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { parseReferralCode } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/server";
import { planBySlug } from "@/lib/plans";
import { ugx } from "@/lib/format";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Join VANTAFINTECH AI Technology: name, number, username and password is all it takes to start.",
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