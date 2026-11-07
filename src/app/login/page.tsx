import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with your username to manage plans, earnings and referrals.",
};

export default async function LoginPage() {
  // Never render the sign-in screen for an active session.
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Username and password — that is all you need."
      footer={
        <p>
          New to Vanta?{" "}
          <Link href="/register" className="font-semibold text-electric hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}