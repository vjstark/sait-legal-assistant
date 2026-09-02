import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, Card, CardBody, EmptyState, PageHeader } from "@/components/ui";

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: courses }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("courses")
      .select("id, name, code, term")
      .order("created_at", { ascending: false }),
  ]);
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <PageHeader
        title="Courses"
        actions={
          isAdmin ? (
            <ButtonLink variant="primary" href="/admin/courses/new">
              New course
            </ButtonLink>
          ) : undefined
        }
      />

      {courses?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Link href={`/courses/${course.id}`} className="block h-full">
                <Card className="h-full transition hover:border-brand-200 hover:shadow-sm">
                  <CardBody>
                    <p className="font-serif text-lg text-brand-900">
                      {course.name}
                    </p>
                    {(course.code || course.term) && (
                      <p className="mt-1 text-sm text-slate-500">
                        {[course.code, course.term].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : isAdmin ? (
        <EmptyState
          title="Create your first course"
          description="Set up a course, then add textbooks, slides, and past exams for your students."
          action={
            <ButtonLink variant="primary" href="/admin/courses/new">
              New course
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          title="No courses yet"
          description="Your admin hasn't added any courses yet. Check back soon."
        />
      )}
    </>
  );
}
