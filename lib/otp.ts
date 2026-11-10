import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacSha256Hex, randomDigits, randomToken, safeEqual } from "@/lib/crypto";
import { emailIsSimulated, sendAccountExistsEmail, sendOtpEmail } from "@/lib/email";
import { SlidingWindowLimiter } from "@/lib/rateLimit";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, OTP_WINDOW_MS, sendBlockReason } from "@/lib/otpPolicy";
import type { OtpPurpose } from "@/lib/generated/prisma/enums";

// Stops one visitor from spraying OTP emails at many different addresses.
const ipLimiter = new SlidingWindowLimiter(20, 60 * 60 * 1000);

/** HMAC-SHA256(OTP_SECRET, purpose:email:code). Only this hash is ever stored. */
const hashOtp = (email: string, purpose: OtpPurpose, code: string) =>
  hmacSha256Hex(env.otpSecret(), `otp:${purpose}:${email}:${code}`);

/**
 * Temporary switch while building on localhost: OTP_BYPASS="true" makes code checks pass
 * with any 6 digits. Always off in production, so a live site can never skip verification.
 */
export function otpBypassed(): boolean {
  return process.env.OTP_BYPASS === "true" && process.env.NODE_ENV !== "production";
}

export type OtpResult = { ok: true } | { ok: false; error: string };
/** `devCode` is only present on localhost without a real email service (see emailIsSimulated). */
export type IssueOtpResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: string; status: 429 | 502; retryAfterSeconds?: number };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Emails a fresh 6-digit code to `email`.
 * Limits (per email, across all purposes): 60 s between sends, max 3 per 10 minutes. Plus 20/hour per IP.
 *
 * `accountExists` (sign-up only): instead of a code, email "you already have an account". A row is
 * still stored, with a hash no 6-digit code can match, so the limits and the response are identical
 * and the website never reveals whether the email is registered.
 */
export async function issueOtp(
  email: string,
  purpose: OtpPurpose,
  opts: { accountExists?: boolean } = {},
): Promise<IssueOtpResult> {
  const now = Date.now();
  // Record this send first, then look at the others: two simultaneous requests can't both slip
  // through the limit. Blocked or failed sends remove their own row so they don't count.
  const send = await db.otpSend.create({ data: { target: email, createdAt: new Date(now) } });
  const dropSend = () => db.otpSend.delete({ where: { id: send.id } }).catch(() => {});
  const others = await db.otpSend.findMany({
    where: { target: email, id: { not: send.id }, createdAt: { gt: new Date(now - OTP_WINDOW_MS), lte: new Date(now) } },
    select: { createdAt: true },
  });
  const blocked = sendBlockReason(
    others.map((r) => r.createdAt),
    now,
  );
  if (blocked) {
    await dropSend();
    return { ok: false, status: 429, ...blocked };
  }
  if (!ipLimiter.hit(await clientIp(), now)) {
    await dropSend();
    return { ok: false, status: 429, error: "Too many codes requested from this network. Try again later." };
  }

  const code = randomDigits(6); // crypto.randomInt — cryptographically secure
  const codeHash = opts.accountExists ? hashOtp(email, purpose, randomToken()) : hashOtp(email, purpose, code);
  // Only the newest code stays valid.
  await db.otpCode.deleteMany({ where: { target: email, purpose } });
  const otp = await db.otpCode.create({
    data: { target: email, purpose, codeHash, expiresAt: new Date(now + OTP_TTL_MS) },
  });

  try {
    if (opts.accountExists) await sendAccountExistsEmail(email);
    else await sendOtpEmail(email, code, purpose);
  } catch (err) {
    // The email helpers' errors never contain the code; log only the provider's reason.
    console.error(`[otp] could not send ${purpose} email:`, err instanceof Error ? err.message : "unknown error");
    // An undelivered code shouldn't count against the limits or stay usable.
    await db.otpCode.delete({ where: { id: otp.id } }).catch(() => {});
    await dropSend();
    return { ok: false, status: 502, error: "We couldn't send the email right now. Please try again in a minute." };
  }
  return emailIsSimulated() && !opts.accountExists ? { ok: true, devCode: code } : { ok: true };
}

/**
 * Checks `code` against the latest unexpired code for this email. Each wrong guess is counted
 * atomically; after OTP_MAX_ATTEMPTS the code is dead. On success the code is deleted.
 */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<OtpResult> {
  const expiredMsg = "This code has expired or wasn't sent to this email. Request a new one.";
  const lockedMsg = "Too many wrong attempts. Request a new code.";

  const otp = await db.otpCode.findFirst({
    where: { target: email, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, error: expiredMsg };

  // Reserve an attempt before comparing, so parallel guesses can't exceed the limit.
  const { count: reserved } = await db.otpCode.updateMany({
    where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (reserved === 0) return { ok: false, error: lockedMsg };

  const valid = /^\d{6}$/.test(code) && safeEqual(otp.codeHash, hashOtp(email, purpose, code));
  if (!valid) {
    const left = OTP_MAX_ATTEMPTS - (otp.attempts + 1);
    return { ok: false, error: left > 0 ? `Wrong code. ${left} attempt${left === 1 ? "" : "s"} left.` : lockedMsg };
  }

  // Delete atomically so the same code can't be used twice.
  const { count } = await db.otpCode.deleteMany({ where: { id: otp.id } });
  return count === 1 ? { ok: true } : { ok: false, error: "This code was already used. Request a new one." };
}
