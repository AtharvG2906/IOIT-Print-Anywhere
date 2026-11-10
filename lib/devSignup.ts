import { randomInt } from "node:crypto";
import { ACADEMIC_YEARS, DEPARTMENTS, normalizePhone, normalizePrn } from "@/lib/validation";

/**
 * Localhost shortcut: on `next dev` the sign-up form can be submitted with empty or wrong fields.
 * Never active in production builds (NODE_ENV is "production" there).
 */
export function relaxedSignup(): boolean {
  return process.env.NODE_ENV === "development";
}

export const DEV_DEFAULT_PASSWORD = "password123";

/** Replaces missing/invalid sign-up values with test values. Pure apart from the random PRN/phone. */
export function fillTestDefaults(raw: Record<string, string>, rand = (max: number) => randomInt(0, max)): Record<string, string> {
  const r = { ...raw };
  const digits = (n: number) => Array.from({ length: n }, () => rand(10)).join("");
  if (r.fullName.trim().length < 2) r.fullName = "Test Student";
  if (!(ACADEMIC_YEARS as readonly string[]).includes(r.academicYear)) r.academicYear = ACADEMIC_YEARS[0];
  if (!(DEPARTMENTS as readonly string[]).includes(r.department)) r.department = DEPARTMENTS[0];
  if (!r.className.trim()) r.className = "TEST";
  if (!r.batch.trim()) r.batch = "T1";
  if (!/^[A-Z0-9]{4,20}$/.test(normalizePrn(r.prn))) r.prn = `DEV${digits(7)}`;
  if (!normalizePhone(r.phone)) r.phone = `9${digits(9)}`;
  if (r.address.trim().length < 5) r.address = "Localhost test address";
  if (r.password.length < 8) r.password = DEV_DEFAULT_PASSWORD;
  r.confirmPassword = r.password;
  return r;
}
