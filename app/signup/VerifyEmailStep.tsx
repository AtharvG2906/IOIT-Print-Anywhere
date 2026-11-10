"use client";

import { useRouter } from "next/navigation";
import { EmailOtpForm } from "@/components/EmailOtpForm";

/** Once the code is verified, re-render the page: the server now sees the verified-email cookie. */
export function VerifyEmailStep({ otpBypass }: { otpBypass: boolean }) {
  const router = useRouter();
  return <EmailOtpForm otpBypass={otpBypass} onVerified={() => router.refresh()} />;
}
