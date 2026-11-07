"use client";

import { useActionState } from "react";
import { signInAction, type ActionState } from "@/lib/actions";
import { Field, Alert } from "@/components/ui/Field";
import { Button } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    signInAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      {!isSupabaseConfigured && (
        <Alert tone="info">
          <strong className="font-semibold">Ledger offline.</strong> Set the Supabase keys and run{" "}
          <code>schema.sql</code> + <code>rpc.sql</code> to activate sign-in.
        </Alert>
      )}

      {state && !state.ok && <Alert tone="error">{state.message}</Alert>}

      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="aisha256"
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}