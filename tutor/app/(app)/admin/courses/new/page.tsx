import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCourse } from "@/app/actions/courses";
import {
  Alert,
  Button,
  Card,
  CardBody,
  FieldHint,
  Input,
  Label,
  PageHeader,
} from "@/components/ui";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorMessage } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/courses");

  return (
    <>
      <PageHeader
        title="New course"
        description="Create a course, then add its materials from the course page."
        backHref="/courses"
        backLabel="Back to courses"
      />

      <div className="max-w-xl space-y-6">
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

        <Card>
          <CardBody>
            <form action={createCourse} className="space-y-5">
              <div>
                <Label htmlFor="course-name">Name</Label>
                <Input id="course-name" type="text" name="name" required />
                <FieldHint>The name shown in the course list, e.g. “Contract Law”.</FieldHint>
              </div>
              <div>
                <Label htmlFor="course-code">Code (optional)</Label>
                <Input id="course-code" type="text" name="code" />
                <FieldHint>The institution&apos;s course code, e.g. “LAW-201”.</FieldHint>
              </div>
              <div>
                <Label htmlFor="course-term">Term (optional)</Label>
                <Input id="course-term" type="text" name="term" />
                <FieldHint>e.g. “Fall 2026” — helps tell repeated courses apart.</FieldHint>
              </div>
              <Button type="submit">Create course</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
