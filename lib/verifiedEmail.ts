import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";

/**
 * After a student enters the right sign-up code, this signed cookie remembers
 * "this browser proved it owns <email>" until they finish the sign-up form.
 * Format: base64url(email).expiresAtMs.hmac — tamper-proof thanks to OTP_SECRET.
 */
const COOKIE = "pa_verified_email";
const TTL_MS = 15 * 60 * 1000;

const sign = (payload: string) => hmacSha256Hex(env.otpSecret(), `verified-email:${payload}`);

export async function setVerifiedEmail(email: string) {
  const payload = `${Buffer.from(email).toString("base64url")}.${Date.now() + TTL_MS}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

/** The verified email, or null if the cookie is missing, forged or expired. */
export async function getVerifiedEmail(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [emailB64, exp, sig] = value.split(".");
  if (!emailB64 || !exp || !sig) return null;
  if (!safeEqual(sig, sign(`${emailB64}.${exp}`))) return null;
  if (!(Number(exp) > Date.now())) return null;
  return Buffer.from(emailB64, "base64url").toString();
}

export async function clearVerifiedEmail() {
  (await cookies()).delete(COOKIE);
}
