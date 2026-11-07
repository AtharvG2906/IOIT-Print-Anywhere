"use client";

/** Localhost only: emails aren't really sent, so show the OTP right on the page. */
export function DevOtpNotice({ code, onFill }: { code: string; onFill: (code: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span>
        🛠 <b>Dev mode</b> — email not actually sent. Your code is{" "}
        <b className="font-mono text-base tracking-widest">{code}</b>
      </span>
      <button type="button" onClick={() => onFill(code)} className="rounded-md bg-amber-200 px-2 py-1 text-xs font-semibold hover:bg-amber-300">
        Fill it in
      </button>
    </div>
  );
}
