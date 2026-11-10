/** Pure OTP rules (no DB / Next imports) so they can be unit tested. */

export const OTP_TTL_MS = 5 * 60 * 1000; // a code is valid for 5 minutes
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per code
export const OTP_COOLDOWN_MS = 60 * 1000; // minimum gap between two sends to one email
export const OTP_WINDOW_MS = 10 * 60 * 1000;
export const OTP_MAX_PER_WINDOW = 3; // sends per email per 10 minutes

export type SendBlock = { error: string; retryAfterSeconds: number };

/**
 * Decides whether another code may be sent to an email, given when the recent codes
 * (inside OTP_WINDOW_MS) were sent. Returns null when sending is allowed.
 */
export function sendBlockReason(recentSends: Date[], now = Date.now()): SendBlock | null {
  const times = recentSends.map((d) => d.getTime()).filter((t) => now - t < OTP_WINDOW_MS).sort((a, b) => b - a);
  if (times.length > 0 && now - times[0] < OTP_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_COOLDOWN_MS - (now - times[0])) / 1000);
    return { error: `Please wait ${wait}s before requesting another code.`, retryAfterSeconds: wait };
  }
  if (times.length >= OTP_MAX_PER_WINDOW) {
    // The oldest send in the window has to age out before another is allowed.
    const oldest = times[OTP_MAX_PER_WINDOW - 1];
    const wait = Math.ceil((OTP_WINDOW_MS - (now - oldest)) / 1000);
    const minutes = Math.max(1, Math.ceil(wait / 60));
    return {
      error: `Too many codes requested for this email. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      retryAfterSeconds: wait,
    };
  }
  return null;
}

/** ALLOWED_EMAIL_DOMAIN may hold one domain or a comma-separated list ("college.edu" or "@college.edu"). */
export function parseAllowedDomains(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** True when no domains are configured, or the email's domain is exactly one of them. */
export function emailDomainAllowed(email: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return allowed.includes(domain);
}

export function domainRestrictionMessage(allowed: string[]): string {
  return `Use your college email address (${allowed.map((d) => `@${d}`).join(" or ")}).`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}
