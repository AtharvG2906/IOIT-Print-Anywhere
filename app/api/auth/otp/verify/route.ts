import { z } from "zod";
import { otpBypassed, verifyOtp } from "@/lib/otp";
import { setVerifiedEmail } from "@/lib/verifiedEmail";
import { readJson, rejectUnsafeJsonRequest } from "@/lib/requestGuard";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  code: z.string().trim(),
});

/**
 * POST /api/auth/otp/verify  { email, code }
 * Checks the latest unexpired sign-up code (max 5 wrong tries, timing-safe compare, deleted on
 * success). On success the browser gets a signed "verified email" cookie; the sign-up form then
 * creates the account and logs the student in.
 */
export async function POST(req: Request) {
  const blocked = rejectUnsafeJsonRequest(req);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: "Enter your email and the 6-digit code." }, { status: 400 });
  const { email, code } = parsed.data;
  if (!/^\d{6}$/.test(code)) return Response.json({ error: "The code is 6 digits." }, { status: 400 });

  const result = otpBypassed() ? ({ ok: true } as const) : await verifyOtp(email, "SIGNUP", code);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  await setVerifiedEmail(email);
  return Response.json({ ok: true });
}
