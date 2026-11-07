"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createAccount, sendSignupOtp, type FormState } from "@/app/actions/auth";
import { ACADEMIC_YEARS, DEPARTMENTS } from "@/lib/validation";
import { Alert, Field, inputClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DevOtpNotice } from "@/components/DevOtpNotice";

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(createAccount, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};

  // Email OTP: the code is tied to the address it was sent to.
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentFor, setSentFor] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sending, startSending] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function changeEmail(value: string) {
    setEmail(value);
    if (sentFor && value.trim().toLowerCase() !== sentFor) {
      setSentTo(null);
      setSentFor(null);
      setDevCode(null);
      setOtp("");
      setCooldown(0);
    }
  }

  function sendOtp() {
    setOtpError(null);
    startSending(async () => {
      const result = await sendSignupOtp(email);
      if (result.ok) {
        setSentTo(result.sentTo);
        setDevCode(result.devCode ?? null);
        setSentFor(email.trim().toLowerCase());
        setCooldown(30);
      } else {
        setOtpError(result.error);
      }
    });
  }

  const sendLabel = sending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : sentTo ? "Resend OTP" : "Send OTP";
  const otpFieldError = e.otp ?? otpError ?? undefined;

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert kind="error">{state.message}</Alert>}

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
          <Field
            label="Email address"
            htmlFor="email"
            error={e.email ?? (!sentTo ? (otpError ?? undefined) : undefined)}
            hint="We'll email you a code to verify it. Print updates are sent here too."
          >
            <div className="flex gap-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => changeEmail(ev.target.value)}
                className={inputClass}
                required
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={sending || cooldown > 0 || !email.trim()}
                className={`${secondaryButtonClass} shrink-0 whitespace-nowrap`}
              >
                {sendLabel}
              </button>
            </div>
          </Field>
        </div>

        {sentTo && (
          <div className="sm:col-span-2">
            <Field label="Email OTP" htmlFor="otp" error={otpFieldError}>
              <p className="mb-2 text-xs text-emerald-700">
                Code sent to <b>{sentTo}</b>. Check your inbox (and spam). It expires in 5 minutes.
              </p>
              <input
                id="otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className={`${inputClass} max-w-[220px] text-center font-mono text-xl tracking-[0.4em]`}
                autoFocus
              />
            </Field>
            {devCode && (
              <div className="mt-2">
                <DevOtpNotice code={devCode} onFill={setOtp} />
              </div>
            )}
          </div>
        )}

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

      {!sentTo && e.otp && <Alert kind="error">{e.otp}</Alert>}
      <SubmitButton pendingText="Creating account…" className="w-full">Create account</SubmitButton>
    </form>
  );
}
