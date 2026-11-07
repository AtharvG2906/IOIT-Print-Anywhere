import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacSha256Hex, randomDigits, safeEqual } from "@/lib/crypto";
import { sendOtpEmail } from "@/lib/email";
import { SlidingWindowLimiter } from "@/lib/rateLimit";
import type { OtpPurpose } from "@/lib/generated/prisma/enums";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_PER_HOUR = 5; // per email address

// Stops one visitor from spraying OTP emails at many different addresses.
const ipLimiter = new SlidingWindowLimiter(20, 60 * 60 * 1000);

const hashOtp = (email: string, purpose: OtpPurpose, code: string) =>
  hmacSha256Hex(env.sessionSecret(), `otp:${purpose}:${email}:${code}`);

export type OtpResult = { ok: true } | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** Emails a fresh 6-digit code to `email`. Rate limited per email and per IP. */
export async function issueOtp(email: string, purpose: OtpPurpose): Promise<OtpResult> {
  const now = Date.now();
  const recent = await db.otpCode.findMany({
    where: { target: email, purpose, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - recent[0].createdAt.getTime())) / 1000);
    return { ok: false, error: `Please wait ${wait}s before requesting another code.` };
  }
  if (recent.length >= OTP_MAX_PER_HOUR) {
    return { ok: false, error: "Too many codes requested for this email. Try again in an hour." };
  }
  if (!ipLimiter.hit(await clientIp(), now)) {
    return { ok: false, error: "Too many codes requested from this network. Try again later." };
  }

  const code = randomDigits(6);
  // Only the newest code stays valid.
  await db.otpCode.updateMany({ where: { target: email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  const otp = await db.otpCode.create({
    data: { target: email, purpose, codeHash: hashOtp(email, purpose, code), expiresAt: new Date(now + OTP_TTL_MS) },
  });
  try {
    await sendOtpEmail(email, code, purpose);
  } catch (err) {
    console.error("[otp] email failed", err);
    // Don't count an undelivered code against the cooldown.
    await db.otpCode.delete({ where: { id: otp.id } }).catch(() => {});
    return { ok: false, error: "We couldn't send the email right now. Check the address and try again." };
  }
  return { ok: true };
}

export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<OtpResult> {
  const otp = await db.otpCode.findFirst({
    where: { target: email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This code has expired or wasn't sent to this email. Request a new one." };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many wrong attempts. Request a new code." };
  }
  if (!/^\d{6}$/.test(code) || !safeEqual(otp.codeHash, hashOtp(email, purpose, code))) {
    const attempts = otp.attempts + 1;
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts } });
    const left = OTP_MAX_ATTEMPTS - attempts;
    return {
      ok: false,
      error: left > 0 ? `Wrong code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code.",
    };
  }
  // Consume atomically so the same code can't be used twice.
  const { count } = await db.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return count === 1 ? { ok: true } : { ok: false, error: "This code was already used. Request a new one." };
}
