"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { Alert, Card, buttonClass } from "@/components/ui";

/** Shown when creating the account fails unexpectedly (server error, timeout, lost connection). */
export default function SignupError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-md space-y-4">
      <Alert kind="error">Something went wrong creating your account. Please try again.</Alert>
      <p className="text-sm text-stone-600">
        If you already see an account for your email, just{" "}
        <Link href="/login" className="font-semibold underline">log in</Link>.
      </p>
      <button type="button" onClick={() => retry()} className={`${buttonClass} w-full`}>
        Try again
      </button>
    </Card>
  );
}
