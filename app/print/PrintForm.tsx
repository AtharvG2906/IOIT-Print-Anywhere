"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { parsePageRange } from "@/lib/pageRange";
import { formatRupees } from "@/lib/pricing";
import { Alert, Card, Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

type UploadedDoc = { documentId: string; name: string; pageCount: number; nonA4Pages: number; sizeBytes: number };

type Props = { ratePaise: number; maxCopies: number; maxFileMB: number; maxPages: number };

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PrintForm({ ratePaise, maxCopies, maxFileMB, maxPages }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [rangeMode, setRangeMode] = useState<"all" | "custom">("all");
  const [rangeText, setRangeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const range = useMemo(
    () => (doc ? parsePageRange(rangeMode === "all" ? "all" : rangeText, doc.pageCount) : null),
    [doc, rangeMode, rangeText],
  );
  const amountPaise = range?.ok ? range.selectedPages * copies * ratePaise : 0;

  function upload(file: File) {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return setError("Only PDF files can be printed. Save or export your document as PDF first.");
    }
    if (file.size > maxFileMB * 1024 * 1024) {
      return setError(`This file is ${formatSize(file.size)}. The limit is ${maxFileMB} MB.`);
    }
    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setDoc(data as unknown as UploadedDoc);
        setCopies(1);
        setRangeMode("all");
        setRangeText("");
      } else {
        setError((data.error as string) ?? "Upload failed. Please try again.");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Upload failed. Check your connection and try again.");
    };
    setProgress(0);
    xhr.send(body);
  }

  async function proceed() {
    if (!doc || !range?.ok) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId: doc.documentId, copies, pageRange: range.normalized }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitting(false);
      return setError(data.error ?? "Couldn't create the order. Please try again.");
    }
    router.push(`/orders/${data.orderId}/pay`);
  }

  return (
    <div className="space-y-5">
      {error && <Alert kind="error">{error}</Alert>}

      {/* Upload */}
      {!doc ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white p-10 text-center transition ${
            dragging ? "border-stone-900 bg-stone-100" : "border-stone-300 hover:border-stone-500"
          }`}
        >
          <span className="text-4xl">📄</span>
          {progress === null ? (
            <>
              <span className="text-base font-semibold">Drop your PDF here or tap to choose</span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                PDF only · max {maxFileMB} MB · max {maxPages} pages
              </span>
              <span className="text-xs text-stone-500">Printed on A4 paper, black &amp; white · {formatRupees(ratePaise)} per page</span>
            </>
          ) : (
            <div className="w-full max-w-xs">
              <p className="mb-2 text-sm font-medium">{progress < 100 ? `Uploading… ${progress}%` : "Checking your PDF…"}</p>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full bg-stone-900 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={progress !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <Card className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{doc.name}</p>
            <p className="text-sm text-stone-600">
              {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"} · {formatSize(doc.sizeBytes)}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => setDoc(null)}>
            Change file
          </button>
        </Card>
      )}

      {doc && doc.nonA4Pages > 0 && (
        <Alert kind="warning">
          {doc.nonA4Pages === doc.pageCount ? "This document isn't A4-sized" : `${doc.nonA4Pages} page${doc.nonA4Pages === 1 ? " isn't" : "s aren't"} A4-sized`}{" "}
          — they will be scaled to fit A4 paper.
        </Alert>
      )}

      {/* Options */}
      {doc && (
        <Card className="space-y-6">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-stone-900 px-3 py-1 text-white">Black &amp; white</span>
            <span className="rounded-full bg-stone-900 px-3 py-1 text-white">A4</span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">{formatRupees(ratePaise)} / page</span>
          </div>

          <Field label="Pages" htmlFor="range" error={rangeMode === "custom" && rangeText && range && !range.ok ? range.error : undefined}>
            <div className="mb-2 flex gap-2">
              {(["all", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRangeMode(m)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    rangeMode === m ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
                  }`}
                >
                  {m === "all" ? `All ${doc.pageCount} pages` : "Custom range"}
                </button>
              ))}
            </div>
            {rangeMode === "custom" && (
              <input
                id="range"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder={`e.g. 1-3,5,8-${Math.min(10, doc.pageCount)}`}
                className={inputClass}
                autoFocus
              />
            )}
          </Field>

          <Field label="Copies" htmlFor="copies" hint={`Maximum ${maxCopies} copies per order.`}>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Fewer copies" disabled={copies <= 1} onClick={() => setCopies((c) => c - 1)} className={`${secondaryButtonClass} w-11`}>
                −
              </button>
              <input
                id="copies"
                type="number"
                min={1}
                max={maxCopies}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(maxCopies, Math.floor(Number(e.target.value) || 1))))}
                className={`${inputClass} w-20 text-center`}
              />
              <button type="button" aria-label="More copies" disabled={copies >= maxCopies} onClick={() => setCopies((c) => c + 1)} className={`${secondaryButtonClass} w-11`}>
                +
              </button>
            </div>
          </Field>

          <div className="rounded-xl bg-stone-50 p-4">
            <div className="flex justify-between text-sm text-stone-600">
              <span>
                {range?.ok ? range.selectedPages : 0} page{range?.ok && range.selectedPages === 1 ? "" : "s"} × {copies} cop{copies === 1 ? "y" : "ies"} × {formatRupees(ratePaise)}
              </span>
              <span>{formatRupees(amountPaise)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>Cover page with your name &amp; code</span>
              <span>Free</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{formatRupees(amountPaise)}</span>
            </div>
          </div>

          <button type="button" disabled={!range?.ok || submitting} onClick={proceed} className={`${buttonClass} w-full py-3 text-base`}>
            {submitting ? "Starting payment…" : `Proceed to pay ${formatRupees(amountPaise)}`}
          </button>
        </Card>
      )}
    </div>
  );
}
