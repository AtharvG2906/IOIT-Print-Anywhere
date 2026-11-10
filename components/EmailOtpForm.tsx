"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { DevOtpNotice } from "@/components/DevOtpNotice";

type ApiResult = { ok?: boolean; error?: string; sentTo?: string; cooldownSeconds?: number; retryAfterSeconds?: number; devCode?: string };

async function postJson(url: string, body: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({}))) as ApiResult;
  } catch {
    return { error: "Network error. Check your connection and try again." };
  }
}

/**
 * Sign-up step 1: email → "Send code" → 6-digit code → "Verify".
 * Calls /api/auth/otp/send and /api/auth/otp/verify; `onVerified` runs after a correct code.
 */
export function EmailOtpForm({ onVerified, otpBypass = false }: { onVerified: () => void; otpBypass?: boolean }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(isResend: boolean) {
    setError(null);
    setInfo(null);
    setBusy("send");
    const r = await postJson("/api/auth/otp/send", { email });
    setBusy(null);
    if (r.retryAfterSeconds) setCooldown(r.retryAfterSeconds);
    if (!r.ok) {
      setError(r.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSentTo(r.sentTo ?? email);
    setDevCode(r.devCode ?? null);
    setCooldown(r.cooldownSeconds ?? 60);
    setCode("");
    setStep("code");
    if (isResend) setInfo("New code sent. Older codes no longer work.");
    setTimeout(() => codeRef.current?.focus(), 0);
  }

  async function verifyCode() {
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy("verify");
    const r = await postJson("/api/auth/otp/verify", { email, code });
    if (!r.ok) {
      setBusy(null);
      setError(r.error ?? "Something went wrong. Please try again.");
      codeRef.current?.select();
      return;
    }
    onVerified(); // keep the button busy while the page refreshes
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setCooldown(0); // the cooldown is per email; the server still enforces it if they reuse this one
    setDevCode(null);
    setError(null);
    setInfo(null);
  }

  if (step === "email") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode(false);
        }}
      >
        {error && <Alert kind="error">{error}</Alert>}
        <Field label="Email address" htmlFor="otp-email" hint="We'll email you a 6-digit code to confirm it's yours.">
          <input
            id="otp-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoFocus
          />
        </Field>
        <button type="submit" className={`${buttonClass} w-full`} disabled={busy !== null || !email.trim() || cooldown > 0}>
          {busy === "send" ? "Sending…" : cooldown > 0 ? `Send code (wait ${cooldown}s)` : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void verifyCode();
      }}
    >
      <Alert kind="success">
        Code sent to <b>{sentTo}</b>. Check your inbox (and spam). It expires in 5 minutes.
      </Alert>
      {info && <Alert kind="info">{info}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {otpBypass && <p className="text-xs text-amber-700">OTP check is turned off for local development — any 6 digits work.</p>}
      {devCode && <DevOtpNotice code={devCode} onFill={setCode} />}
      <Field label="6-digit code" htmlFor="otp-code">
        <input
          ref={codeRef}
          id="otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          className={`${inputClass} max-w-[220px] text-center font-mono text-xl tracking-[0.4em]`}
          autoFocus
        />
      </Field>
      <button type="submit" className={`${buttonClass} w-full`} disabled={busy !== null || code.length !== 6}>
        {busy === "verify" ? "Verifying…" : "Verify email"}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={changeEmail} className="text-stone-600 underline" disabled={busy !== null}>
          Use a different email
        </button>
        <button
          type="button"
          onClick={() => void sendCode(true)}
          disabled={busy !== null || cooldown > 0}
          className={`${secondaryButtonClass} px-3 py-1.5`}
        >
          {busy === "send" ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
