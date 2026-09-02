import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudySession } from "@/components/study-session";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: course }, { data: courses }, { data: documents }, { data: profile }] =
    await Promise.all([
      supabase.from("courses").select("id, name, code").eq("id", courseId).single(),
      supabase.from("courses").select("id, name").order("name"),
      supabase
        .from("documents")
        // No review_status filter here — RLS already scopes rows per
        // viewer (students: approved only; contributors: approved + their
        // own pending; admins: all), so this returns exactly what each
        // viewer is allowed to manage inline in the materials column.
        .select(
          "id, title, category, page_count, duration_seconds, status, review_status, uploaded_by",
        )
        .eq("course_id", courseId)
        .order("title"),
      user
        ? supabase.from("profiles").select("role").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
    ]);
  if (!course) notFound();

  return (
    <StudySession
      courseId={course.id}
      courseName={course.code ? `${course.name} (${course.code})` : course.name}
      courses={courses ?? []}
      documents={documents ?? []}
      role={profile?.role ?? "student"}
      viewerId={user?.id ?? null}
    />
  );
}
