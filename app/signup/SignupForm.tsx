"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createAccount, forgetVerifiedEmail, type FormState } from "@/app/actions/auth";
import { ACADEMIC_YEARS, DEPARTMENTS } from "@/lib/validation";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";

// Form order, so we can jump to the first field with a problem.
const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  academicYear: "Academic year",
  prn: "PRN",
  department: "Department",
  className: "Class / division",
  batch: "Batch",
  phone: "Phone number",
  email: "Email address",
  address: "Residential address",
  password: "Password",
  confirmPassword: "Confirm password",
  collegeId: "College ID card",
};

const MAX_ID_BYTES = 4 * 1024 * 1024;

/** Big phone photos are shrunk in the browser (longest side 1600 px, JPEG) so uploads are quick. */
async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // the server still checks size and type
  }
}

/** Sign-up step 2: the email is already verified (signed cookie); collect details and a password. */
export function SignupForm({ verifiedEmail, relaxed = false }: { verifiedEmail: string; relaxed?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAccount, {});
  // "Change"/"Verify again" are plain buttons (not submit buttons), so pressing Enter in a field
  // always submits "Create account" instead of throwing the student back to the email step.
  const [leaving, startLeaving] = useTransition();
  const [, startSubmit] = useTransition();
  const restartVerification = () => startLeaving(() => forgetVerifiedEmail());
  const summaryRef = useRef<HTMLDivElement>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [idBusy, setIdBusy] = useState(false);
  const e = { ...(state.errors ?? {}) };
  if (idError) e.collegeId = idError;
  else if (idFile) delete e.collegeId; // a new file was chosen since the last attempt

  async function chooseId(file: File | null) {
    setIdError(null);
    if (idPreview) URL.revokeObjectURL(idPreview);
    setIdPreview(null);
    if (!file) return setIdFile(null);
    setIdBusy(true);
    const ready = await shrinkPhoto(file);
    setIdBusy(false);
    if (ready.size > MAX_ID_BYTES) {
      setIdFile(null);
      return setIdError("This file is bigger than 4 MB. Take a smaller photo or use a PDF.");
    }
    setIdFile(ready);
    if (ready.type.startsWith("image/")) setIdPreview(URL.createObjectURL(ready));
  }

  const problemFields = Object.keys(FIELD_LABELS).filter((k) => e[k]);
  const hasProblem = problemFields.length > 0 || Boolean(state.message);

  // After a failed attempt, take the student straight to the first problem.
  useEffect(() => {
    const first = problemFields[0];
    const el = first ? document.getElementById(first) : summaryRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (first) (el as HTMLElement).focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Red outline on fields with a problem.
  const cls = (key: string, extra = "") => `${inputClass} ${extra} ${e[key] ? "border-red-500! ring-2 ring-red-500/15" : ""}`;
  const invalid = (key: string) => (e[key] ? true : undefined);

  return (
    <form
      className="space-y-5"
      noValidate
      // Submitting this way (instead of <form action>) stops React from clearing the form after a
      // failed attempt, so dropdowns and passwords keep what the student typed.
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        // Send the (possibly shrunk) photo instead of the original.
        if (idFile) data.set("collegeId", idFile);
        else data.delete("collegeId");
        startSubmit(() => action(data));
      }}
    >
      {relaxed && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          🛠 <b>Localhost:</b> you can skip fields — empty or wrong ones are filled with test values (password{" "}
          <code>password123</code> if left empty). This never applies on the live site.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full name" htmlFor="fullName" error={e.fullName}>
            <input id="fullName" name="fullName" autoComplete="name" aria-invalid={invalid("fullName")} className={cls("fullName")} required />
          </Field>
        </div>

        <Field label="Academic year" htmlFor="academicYear" error={e.academicYear}>
          <select id="academicYear" name="academicYear" defaultValue="" aria-invalid={invalid("academicYear")} className={cls("academicYear")} required>
            <option value="" disabled>Select…</option>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label="PRN" htmlFor="prn" error={e.prn} hint="Your unique college registration number.">
          <input id="prn" name="prn" aria-invalid={invalid("prn")} className={cls("prn", "uppercase")} required />
        </Field>

        <Field label="Department" htmlFor="department" error={e.department}>
          <select id="department" name="department" defaultValue="" aria-invalid={invalid("department")} className={cls("department")} required>
            <option value="" disabled>Select…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Class / division" htmlFor="className" error={e.className}>
          <input id="className" name="className" placeholder="e.g. SY-B" aria-invalid={invalid("className")} className={cls("className")} required />
        </Field>
        <Field label="Batch" htmlFor="batch" error={e.batch}>
          <input id="batch" name="batch" placeholder="e.g. B2" aria-invalid={invalid("batch")} className={cls("batch")} required />
        </Field>

        <Field label="Phone number" htmlFor="phone" error={e.phone} hint="10-digit mobile number starting with 6, 7, 8 or 9.">
          <div className="flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 text-sm text-stone-600">+91</span>
            <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} aria-invalid={invalid("phone")} className={cls("phone", "rounded-l-none")} required />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email address" htmlFor="email" error={e.email} hint="Print updates are sent here.">
            <div className="flex items-center gap-2">
              <input id="email" type="email" value={verifiedEmail} readOnly disabled className={inputClass} />
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">✓ Verified</span>
              <button type="button" onClick={restartVerification} disabled={leaving} className="shrink-0 text-sm text-stone-600 underline">
                Change
              </button>
            </div>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Residential address" htmlFor="address" error={e.address}>
            <textarea id="address" name="address" rows={2} autoComplete="street-address" aria-invalid={invalid("address")} className={cls("address")} required />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="College ID card"
            htmlFor="collegeId"
            error={e.collegeId}
            hint="A clear photo (or PDF) of your college ID card. Only the print desk can see it."
          >
            <label
              className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed bg-stone-50 p-4 hover:border-stone-500 ${
                e.collegeId ? "border-red-500" : "border-stone-300"
              }`}
            >
              {idPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={idPreview} alt="ID card preview" className="h-20 w-32 rounded-md object-cover" />
              ) : (
                <span className="grid h-20 w-32 place-items-center rounded-md bg-white text-3xl">🪪</span>
              )}
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold">
                  {idBusy ? "Preparing photo…" : idFile ? idFile.name : "Choose photo or PDF"}
                </span>
                <span className="text-xs text-stone-500">JPG, PNG or PDF · max 4 MB</span>
              </span>
              <input
                id="collegeId"
                name="collegeId"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                aria-invalid={invalid("collegeId")}
                className="sr-only"
                onChange={(ev) => void chooseId(ev.target.files?.[0] ?? null)}
              />
            </label>
          </Field>
        </div>

        <Field label="Password" htmlFor="password" error={e.password} hint="At least 8 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={invalid("password")} className={cls("password")} required />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={e.confirmPassword}>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={invalid("confirmPassword")} className={cls("confirmPassword")} required />
        </Field>
      </div>

      {/* The problem is always shown right above the button, where the student is looking. */}
      {hasProblem && !pending && (
        <div ref={summaryRef}>
          <Alert kind="error">
            {state.message ?? (
              <>
                Please fix: <b>{problemFields.map((k) => FIELD_LABELS[k]).join(", ")}</b>
              </>
            )}{" "}
            {state.step === "reverify" && (
              <button type="button" onClick={restartVerification} disabled={leaving} className="font-semibold underline">
                Verify again
              </button>
            )}
          </Alert>
        </div>
      )}

      <button type="submit" disabled={pending || leaving || idBusy} className={`${buttonClass} w-full`}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
