import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Alert, Card, PageTitle } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/print");
  const { reset } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <PageTitle
        title="Log in"
        subtitle={
          <>
            New here? <Link href="/signup" className="font-semibold underline">Create an account</Link>
          </>
        }
      />
      <Card className="space-y-4">
        {reset && <Alert kind="success">Password changed. Log in with your new password.</Alert>}
        <LoginForm />
      </Card>
    </div>
  );
}
