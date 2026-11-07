"use client";

import { useActionState } from "react";
import { signUpAction, type ActionState } from "@/lib/actions";
import { Field, Alert } from "@/components/ui/Field";
import { Button } from "@/components/ui/primitives";

export function RegisterForm({
  defaultRef = "",
  planLabel,
}: {
  defaultRef?: string;
  planLabel?: string;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    signUpAction,
    undefined,
  );

  const invited = defaultRef.length > 0;

  return (
    <form action={action} className="space-y-4">
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}

      {invited && (
        <Alert tone="info">
          Invitation accepted — your referral link has been filled in for you.
        </Alert>
      )}

      {planLabel && <Alert tone="success">{planLabel} selected. Fund your wallet after sign-up.</Alert>}

      <Field
        label="Name"
        name="full_name"
        autoComplete="name"
        placeholder="Aisha Nabirye"
        required
        error={state?.field === "full_name" ? state.message : undefined}
      />

      <Field
        label="Number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0772 123 456"
        required
        hint="Mobile money number"
        error={state?.field === "phone" ? state.message : undefined}
      />

      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="aisha256"
        pattern="[a-zA-Z0-9_]{3,16}"
        minLength={3}
        maxLength={16}
        required
        hint="3–16 letters or numbers"
        error={state?.field === "username" ? state.message : undefined}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        minLength={8}
        required
        hint="Min 8 characters"
        error={state?.field === "password" ? state.message : undefined}
      />

      <Field
        label="Referral link"
        name="ref"
        defaultValue={defaultRef}
        readOnly={invited}
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="Enter code if you were invited"
        hint={invited ? "Auto-filled" : "Optional"}
        className={invited ? "text-electric" : undefined}
      />

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create my account"}
      </Button>

      <p className="text-[10.5px] leading-relaxed text-slate-deep">
        By continuing you agree to the terms and confirm you have read the risk disclosure.
        Investment products carry risk, including loss of capital.
      </p>
    </form>
  );
}