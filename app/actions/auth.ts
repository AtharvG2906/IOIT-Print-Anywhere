"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/email";
import { Prisma } from "@/lib/generated/prisma/client";
import { createSession, destroySession, hashPassword, isAdminUser, verifyPassword } from "@/lib/auth";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { fieldErrors, normalizePrn, passwordSchema, signupSchema, type SignupInput } from "@/lib/validation";

const RESET_COOKIE = "pa_reset";

const tempCookie = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeSeconds,
});

export type FormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  message?: string;
  step?: string;
  devCode?: string; // localhost only: the OTP, shown on screen because emails aren't really sent
};

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}

// ---------- Create account ----------

export type SendOtpResult = { ok: true; sentTo: string; devCode?: string } | { ok: false; error: string };

/** "Send OTP" button on the signup form: emails a 6-digit code right away. */
export async function sendSignupOtp(rawEmail: string): Promise<SendOtpResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address first." };
  const email = parsed.data;

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "An account with this email already exists. Try logging in." };
  }
  const sent = await issueOtp(email, "SIGNUP");
  return sent.ok ? { ok: true, sentTo: maskEmail(email), devCode: sent.devCode } : sent;
}

const SIGNUP_FIELDS = [
  "fullName", "email", "password", "confirmPassword", "academicYear", "department",
  "className", "batch", "prn", "address", "phone",
] as const;

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(SIGNUP_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const otp = String(formData.get("otp") ?? "").trim();
  // Never echo passwords back to the form.
  const values = { ...raw, password: "", confirmPassword: "" };

  const parsed = signupSchema.safeParse(raw);
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  if (!otp) errors.otp = "Click “Send OTP” and enter the 6-digit code from your email.";
  if (!parsed.success || errors.otp) return { errors, values };

  const data = parsed.data;
  const taken = await findTakenFields(data);
  if (Object.keys(taken).length) return { errors: taken, values };

  const result = await verifyOtp(data.email, "SIGNUP", otp);
  if (!result.ok) return { errors: { otp: result.error }, values };

  let user;
  try {
    user = await db.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        passwordHash: await hashPassword(data.password),
        phone: data.phone,
        emailVerifiedAt: new Date(),
        prn: data.prn,
        academicYear: data.academicYear,
        department: data.department,
        className: data.className,
        batch: data.batch,
        address: data.address,
        role: isAdminUser({ role: "STUDENT", email: data.email }) ? "ADMIN" : "STUDENT",
      },
    });
  } catch (err) {
    // Someone registered the same email/PRN/phone a moment ago.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { errors: await findTakenFields(data), values };
    }
    throw err;
  }

  await sendWelcomeEmail({
    to: user.email,
    name: user.fullName,
    prn: user.prn,
    department: user.department,
    appUrl: env.appUrl(),
  });
  await createSession(user.id);
  redirect("/signup/college-id");
}

async function findTakenFields(d: Pick<SignupInput, "email" | "prn" | "phone">) {
  const existing = await db.user.findMany({
    where: { OR: [{ email: d.email }, { prn: d.prn }, { phone: d.phone }] },
    select: { email: true, prn: true, phone: true },
  });
  const errors: Record<string, string> = {};
  for (const u of existing) {
    if (u.email === d.email) errors.email = "An account with this email already exists. Try logging in.";
    if (u.prn === d.prn) errors.prn = "This PRN is already registered. Try logging in.";
    if (u.phone === d.phone) errors.phone = "This phone number is already registered.";
  }
  return errors;
}

// ---------- Log in / log out ----------

const failedLogins = new Map<string, { count: number; first: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const values = { identifier };
  if (!identifier || !password) return { message: "Enter your email or PRN and your password.", values };

  const key = identifier.toLowerCase();
  const rec = failedLogins.get(key);
  if (rec && Date.now() - rec.first < LOGIN_WINDOW_MS && rec.count >= LOGIN_MAX_FAILURES) {
    return { message: "Too many failed attempts. Try again in 15 minutes or reset your password.", values };
  }

  const user = identifier.includes("@")
    ? await db.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await db.user.findUnique({ where: { prn: normalizePrn(identifier) } });

  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    const r = rec && Date.now() - rec.first < LOGIN_WINDOW_MS ? rec : { count: 0, first: Date.now() };
    r.count++;
    failedLogins.set(key, r);
    return { message: "Incorrect email/PRN or password.", values };
  }
  if (user.blocked) return { message: "This account has been blocked. Please contact the print desk.", values };

  failedLogins.delete(key);
  await createSession(user.id);
  redirect(isAdminUser(user) ? "/admin" : user.collegeIdKey ? "/print" : "/signup/college-id");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------- Forgot password ----------

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { errors: { identifier: "Enter your email or PRN." } };

  const user = identifier.includes("@")
    ? await db.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await db.user.findUnique({ where: { prn: normalizePrn(identifier) } });

  let devCode: string | undefined;
  if (user && !user.blocked) {
    const sent = await issueOtp(user.email, "RESET");
    if (!sent.ok) return { errors: { identifier: sent.error }, values: { identifier } };
    devCode = sent.devCode;
    (await cookies()).set(RESET_COOKIE, user.id, tempCookie(15 * 60));
  } else {
    (await cookies()).delete(RESET_COOKIE);
  }
  // Same response either way so accounts can't be discovered here.
  return { step: "otp", message: "If that account exists, we've sent a 6-digit code to its registered email.", devCode };
}

export async function completePasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const userId = jar.get(RESET_COOKIE)?.value;
  const user = userId ? await db.user.findUnique({ where: { id: userId } }) : null;
  if (!user) return { step: "otp", errors: { otp: "Wrong or expired code. Start again." } };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { step: "otp", errors: { password: pw.error.issues[0].message } };
  if (password !== confirm) return { step: "otp", errors: { confirmPassword: "Passwords don't match." } };

  const result = await verifyOtp(user.email, "RESET", String(formData.get("otp") ?? "").trim());
  if (!result.ok) return { step: "otp", errors: { otp: result.error } };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId: user.id } });
  jar.delete(RESET_COOKIE);
  redirect("/login?reset=1");
}
