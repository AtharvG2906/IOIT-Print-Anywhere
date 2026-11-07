import { z } from "zod";

export const ACADEMIC_YEARS = ["FY", "SY", "TY", "B.Tech"] as const;
export const DEPARTMENTS = ["CS", "IT", "AIDS", "ENTC", "Electrical", "Instrumentation"] as const;

/** Accepts "+91 98765 43210", "09876543210", "9876543210" → "9876543210". */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const normalizePrn = (input: string) => input.trim().toUpperCase().replace(/\s+/g, "");

const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number." });
      return z.NEVER;
    }
    return p;
  });

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(100),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
    password: passwordSchema,
    confirmPassword: z.string(),
    academicYear: z.enum(ACADEMIC_YEARS, { message: "Select your academic year." }),
    department: z.enum(DEPARTMENTS, { message: "Select your department." }),
    className: z.string().trim().min(1, "Enter your class / division.").max(50),
    batch: z.string().trim().min(1, "Enter your batch.").max(50),
    prn: z
      .string()
      .transform(normalizePrn)
      .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, "PRN should be 4–20 letters or digits.")),
    address: z.string().trim().min(5, "Enter your residential address.").max(300),
    phone: phoneSchema,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const orderInputSchema = z.object({
  documentId: z.string().min(1),
  copies: z.coerce.number().int().min(1),
  pageRange: z.string().max(200).default("all"),
});

/** Field → first error message, for showing next to form inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
