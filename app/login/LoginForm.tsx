"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type FormState } from "@/app/actions/auth";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      {state.message && <Alert kind="error">{state.message}</Alert>}
      <Field label="Email or PRN" htmlFor="identifier">
        <input id="identifier" name="identifier" autoComplete="username" defaultValue={state.values?.identifier} className={inputClass} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" className={inputClass} required />
      </Field>
      <SubmitButton pendingText="Logging in…" className="w-full">Log in</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-stone-600 underline">Forgot password?</Link>
      </p>
      <p className="text-center text-xs text-stone-500">For your safety you&apos;re logged out when you close the browser.</p>
    </form>
  );
}
