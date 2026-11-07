import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { otpBypassed } from "@/lib/otp";
import { Card, PageTitle } from "@/components/ui";
import { SignupForm } from "./SignupForm";
import { Steps } from "@/components/SignupSteps";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/print");
  return (
    <div className="mx-auto max-w-2xl">
      <Steps current={1} />
      <PageTitle
        title="Create your account"
        subtitle={
          <>
            Already have one? <Link href="/login" className="font-semibold underline">Log in</Link>
          </>
        }
      />
      <Card>
        <SignupForm otpBypass={otpBypassed()} />
      </Card>
    </div>
  );
}
