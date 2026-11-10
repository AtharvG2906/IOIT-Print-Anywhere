"use client";

import { useActionState, useTransition } from "react";
import { createAccount, forgetVerifiedEmail, type FormState } from "@/app/actions/auth";
import { ACADEMIC_YEARS, DEPARTMENTS } from "@/lib/validation";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

/** Sign-up step 2: the email is already verified (signed cookie); collect details and a password. */
export function SignupForm({ verifiedEmail }: { verifiedEmail: string }) {
  const [state, action] = useActionState<FormState, FormData>(createAccount, {});
  // "Change"/"Verify again" are plain buttons (not submit buttons), so pressing Enter in a field
  // always submits "Create account" instead of throwing the student back to the email step.
  const [leaving, startLeaving] = useTransition();
  const restartVerification = () => startLeaving(() => forgetVerifiedEmail());
  const e = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <Alert kind="error">
          {state.message}{" "}
          {state.step === "reverify" && (
            <button type="button" onClick={restartVerification} disabled={leaving} className="font-semibold underline">
              Verify again
            </button>
          )}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full name" htmlFor="fullName" error={e.fullName}>
            <input id="fullName" name="fullName" autoComplete="name" defaultValue={v.fullName} className={inputClass} required />
          </Field>
        </div>

        <Field label="Academic year" htmlFor="academicYear" error={e.academicYear}>
          <select id="academicYear" name="academicYear" defaultValue={v.academicYear ?? ""} className={inputClass} required>
            <option value="" disabled>Select…</option>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label="PRN" htmlFor="prn" error={e.prn} hint="Your unique college registration number.">
          <input id="prn" name="prn" defaultValue={v.prn} className={`${inputClass} uppercase`} required />
        </Field>

        <Field label="Department" htmlFor="department" error={e.department}>
          <select id="department" name="department" defaultValue={v.department ?? ""} className={inputClass} required>
            <option value="" disabled>Select…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Class / division" htmlFor="className" error={e.className}>
          <input id="className" name="className" placeholder="e.g. SY-B" defaultValue={v.className} className={inputClass} required />
        </Field>
        <Field label="Batch" htmlFor="batch" error={e.batch}>
          <input id="batch" name="batch" placeholder="e.g. B2" defaultValue={v.batch} className={inputClass} required />
        </Field>

        <Field label="Phone number" htmlFor="phone" error={e.phone}>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 text-sm text-stone-600">+91</span>
            <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} defaultValue={v.phone} className={`${inputClass} rounded-l-none`} required />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email address" htmlFor="email" error={e.email} hint="Print updates are sent here.">
            <div className="flex items-center gap-2">
              <input id="email" type="email" value={verifiedEmail} readOnly disabled className={inputClass} />
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">✓ Verified</span>
              <button type="button" onClick={restartVerification} disabled={leaving} className="shrink-0 text-sm text-stone-600 underline">
                Change
              </button>
            </div>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Residential address" htmlFor="address" error={e.address}>
            <textarea id="address" name="address" rows={2} autoComplete="street-address" defaultValue={v.address} className={inputClass} required />
          </Field>
        </div>

        <Field label="Password" htmlFor="password" error={e.password} hint="At least 8 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass} required />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={e.confirmPassword}>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className={inputClass} required />
        </Field>
      </div>

      <SubmitButton pendingText="Creating account…" className="w-full">Create account</SubmitButton>
    </form>
  );
}
