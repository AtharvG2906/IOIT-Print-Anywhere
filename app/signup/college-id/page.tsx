import { requireUser } from "@/lib/auth";
import { Card, PageTitle } from "@/components/ui";
import { Steps } from "@/components/SignupSteps";
import { CollegeIdForm } from "./CollegeIdForm";

export default async function CollegeIdPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md">
      <Steps current={2} />
      <PageTitle
        title={user.hasCollegeId ? "Replace your college ID" : "Upload your college ID"}
        subtitle="The desk uses it to confirm it's really you when you collect prints. Only desk staff can see it."
      />
      <Card>
        <CollegeIdForm hasExisting={user.hasCollegeId} />
      </Card>
    </div>
  );
}
