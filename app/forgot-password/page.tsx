import { Card, PageTitle } from "@/components/ui";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Reset your password" subtitle="We'll email a code to the address on your account." />
      <Card>
        <ForgotPasswordForm />
      </Card>
    </div>
  );
}
