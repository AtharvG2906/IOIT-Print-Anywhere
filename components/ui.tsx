import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px] outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:bg-stone-100";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-50";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  }[kind];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

const STATUS_STYLES: Record<string, [string, string]> = {
  PENDING_PAYMENT: ["Awaiting payment", "bg-amber-100 text-amber-800"],
  PAID: ["In print queue", "bg-sky-100 text-sky-800"],
  PRINTING: ["Printing", "bg-indigo-100 text-indigo-800"],
  READY: ["Ready for pickup", "bg-emerald-100 text-emerald-800"],
  COLLECTED: ["Collected", "bg-stone-200 text-stone-700"],
  EXPIRED: ["Expired (unpaid)", "bg-stone-100 text-stone-500"],
  FAILED: ["Print failed — see desk", "bg-red-100 text-red-800"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS_STYLES[status] ?? [status, "bg-stone-100 text-stone-700"];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function PrintingCode({ code, size = "lg" }: { code: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={
        size === "lg"
          ? "inline-block rounded-xl border-[3px] border-stone-900 px-5 py-2 font-mono text-4xl font-bold tracking-[0.2em]"
          : "font-mono font-bold tracking-wider"
      }
    >
      {code}
    </span>
  );
}
