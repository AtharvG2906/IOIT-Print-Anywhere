import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { otpBypassed } from "@/lib/otp";
import { relaxedSignup } from "@/lib/devSignup";
import { getVerifiedEmail } from "@/lib/verifiedEmail";
import { Card, PageTitle } from "@/components/ui";
import { SignupForm } from "./SignupForm";
import { VerifyEmailStep } from "./VerifyEmailStep";
import { Steps } from "@/components/SignupSteps";

export default async function SignupPage() {
  const current = await getCurrentUser();
  if (current) redirect(homePathFor(current));
  const verifiedEmail = await getVerifiedEmail();
  return (
    <div className="mx-auto max-w-2xl">
      <Steps current={verifiedEmail ? 2 : 1} />
      <PageTitle
        title="Create your account"
        subtitle={
          <>
            Already have one? <Link href="/login" className="font-semibold underline">Log in</Link>
          </>
        }
      />
      {verifiedEmail ? (
        <Card>
          <SignupForm verifiedEmail={verifiedEmail} relaxed={relaxedSignup()} />
        </Card>
      ) : (
        <Card className="mx-auto max-w-md">
          <h2 className="mb-4 font-semibold">First, verify your email</h2>
          <VerifyEmailStep otpBypass={otpBypassed()} />
        </Card>
      )}
    </div>
  );
}
