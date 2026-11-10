"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/email";
import { Prisma } from "@/lib/generated/prisma/client";
import { createSession, destroySession, hashPassword, isAdminUser, verifyPassword } from "@/lib/auth";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { domainRestrictionMessage, emailDomainAllowed, parseAllowedDomains } from "@/lib/otpPolicy";
import { clearVerifiedEmail, getVerifiedEmail } from "@/lib/verifiedEmail";
import { checkCollegeIdFile, deleteCollegeId, saveCollegeId } from "@/lib/collegeId";
import { fillTestDefaults, relaxedSignup } from "@/lib/devSignup";
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

// ---------- Create account ----------
// Step 1 (email + code) uses POST /api/auth/otp/send and /api/auth/otp/verify, which leave a
// signed "verified email" cookie. Step 2 below creates the account for that email only.

/** "Change email" on the sign-up form. */
export async function forgetVerifiedEmail() {
  await clearVerifiedEmail();
  redirect("/signup");
}

const SIGNUP_FIELDS = [
  "fullName", "email", "password", "confirmPassword", "academicYear", "department",
  "className", "batch", "prn", "address", "phone",
] as const;

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  // The email comes from the signed cookie set by the verify endpoint, never from the form.
  const verifiedEmail = await getVerifiedEmail();
  let raw = Object.fromEntries(SIGNUP_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  // Never echo passwords back to the form.
  const values = { ...raw, password: "", confirmPassword: "" };
  if (!verifiedEmail) {
    return { values, message: "Your email verification expired. Please verify your email again.", step: "reverify" };
  }
  raw.email = verifiedEmail;

  // Localhost only: fill anything missing with test values so testing is quick.
  const relaxed = relaxedSignup();
  if (relaxed) raw = fillTestDefaults(raw);

  const parsed = signupSchema.safeParse(raw);
  const errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);
  const idFile = await checkCollegeIdFile(formData.get("collegeId"));
  if (idFile && "error" in idFile) errors.collegeId = idFile.error;
  else if (!idFile && !relaxed) errors.collegeId = "Add a photo of your college ID card.";
  if (!parsed.success || Object.keys(errors).length) return { errors, values };
  const data = parsed.data;

  const allowed = parseAllowedDomains(env.allowedEmailDomain());
  if (!emailDomainAllowed(data.email, allowed)) return { message: domainRestrictionMessage(allowed), values };

  const taken = await findTakenFields(data);
  if (Object.keys(taken).length) return { errors: taken, values };

  // Save the ID card first (into the admin's Google Drive folder when set up). No account without it.
  let collegeIdKey: string | null = null;
  if (idFile && !("error" in idFile)) {
    try {
      collegeIdKey = await saveCollegeId(idFile, { prn: data.prn, fullName: data.fullName });
    } catch (err) {
      console.error("[signup] saving college ID failed:", err instanceof Error ? err.message : err);
      return { errors: { collegeId: "We couldn't save your ID card right now. Please try again in a minute." }, values };
    }
  }

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
        collegeIdKey,
        role: isAdminUser({ role: "STUDENT", email: data.email }) ? "ADMIN" : "STUDENT",
      },
    });
  } catch (err) {
    // Don't leave an orphaned ID card behind.
    if (collegeIdKey) await deleteCollegeId(collegeIdKey).catch(() => {});
    // Someone registered the same email/PRN/phone a moment ago.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { errors: await findTakenFields(data), values };
    }
    throw err;
  }

  await clearVerifiedEmail();
  await sendWelcomeEmail({
    to: user.email,
    name: user.fullName,
    prn: user.prn,
    department: user.department,
    appUrl: env.appUrl(),
  });
  // Logged in straight away — no second login.
  await createSession(user.id);
  redirect(isAdminUser(user) ? "/admin" : "/dashboard");
}

async function findTakenFields(d: Pick<SignupInput, "email" | "prn" | "phone">) {
  const existing = await db.user.findMany({
    where: { OR: [{ email: d.email }, { prn: d.prn }, { phone: d.phone }] },
    select: { email: true, prn: true, phone: true },
  });
  const errors: Record<string, string> = {};
  for (const u of existing) {
    // Only reachable after the student proved they own this email, so this reveals nothing new.
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
  redirect(isAdminUser(user) ? "/admin" : "/dashboard");
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
    // Show the same message even when sending failed or was rate limited, so this form can't be
    // used to discover accounts. (issueOtp already logged any email failure.)
    if (sent.ok) devCode = sent.devCode;
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
