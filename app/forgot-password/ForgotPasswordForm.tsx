"use client";

import { useActionState, useState } from "react";
import { completePasswordReset, requestPasswordReset, type FormState } from "@/app/actions/auth";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DevOtpNotice } from "@/components/DevOtpNotice";

export function ForgotPasswordForm() {
  const [requestState, request] = useActionState<FormState, FormData>(requestPasswordReset, {});
  const [resetState, reset] = useActionState<FormState, FormData>(completePasswordReset, {});
  const [otp, setOtp] = useState("");

  if (requestState.step !== "otp") {
    return (
      <form action={request} className="space-y-4">
        <Field label="Email or PRN" htmlFor="identifier" error={requestState.errors?.identifier}>
          <input id="identifier" name="identifier" defaultValue={requestState.values?.identifier} className={inputClass} required autoFocus />
        </Field>
        <SubmitButton pendingText="Sending…" className="w-full">Send code</SubmitButton>
      </form>
    );
  }

  const e = resetState.errors ?? {};
  return (
    <form action={reset} className="space-y-4">
      <Alert kind="info">{requestState.message}</Alert>
      {requestState.devCode && <DevOtpNotice code={requestState.devCode} onFill={setOtp} />}
      <Field label="6-digit code" htmlFor="otp" error={e.otp}>
        <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, ""))} className={`${inputClass} font-mono tracking-[0.4em]`} required autoFocus />
      </Field>
      <Field label="New password" htmlFor="password" error={e.password} hint="At least 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={e.confirmPassword}>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className={inputClass} required />
      </Field>
      <SubmitButton pendingText="Saving…" className="w-full">Change password</SubmitButton>
    </form>
  );
}
