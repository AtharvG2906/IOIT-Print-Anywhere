"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, buttonClass } from "@/components/ui";

export function CollegeIdForm({ hasExisting }: { hasExisting: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choose(f: File | null) {
    setError(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    if (f && f.size > 5 * 1024 * 1024) setError("File must be 5 MB or smaller.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a photo or PDF of your college ID.");
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/college-id", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Upload failed. Please try again.");
    }
    router.push("/print");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center hover:border-stone-500">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="College ID preview" className="max-h-48 rounded-lg" />
        ) : (
          <span className="text-3xl">🪪</span>
        )}
        <span className="text-sm font-semibold">{file ? file.name : "Choose a photo or PDF"}</span>
        <span className="text-xs text-stone-500">JPG, PNG or PDF · max 5 MB · make sure your name and PRN are readable</span>
        <input type="file" accept="image/jpeg,image/png,application/pdf" capture="environment" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      </label>
      <button type="submit" disabled={busy || !file} className={`${buttonClass} w-full`}>
        {busy ? "Uploading…" : hasExisting ? "Replace college ID" : "Upload & continue"}
      </button>
    </form>
  );
}
