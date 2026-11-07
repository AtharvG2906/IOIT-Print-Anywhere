"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui";

export function SubmitButton({ children, pendingText, className = "" }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass} ${className}`}>
      {pending ? (pendingText ?? "Please wait…") : children}
    </button>
  );
}
