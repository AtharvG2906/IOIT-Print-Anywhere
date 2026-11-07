"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the current server page every few seconds (live order status, desk queue). */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
