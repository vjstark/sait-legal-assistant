"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "course-files";

export async function createCourse(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/admin/courses/new?error=" + encodeURIComponent("Course name is required."));
  }

  const { error } = await supabase.from("courses").insert({
    name,
    code: String(formData.get("code") ?? "").trim() || null,
    term: String(formData.get("term") ?? "").trim() || null,
    created_by: user.id,
  });

  // RLS blocks non-admins from inserting — this surfaces as a Postgres error here.
  if (error) {
    redirect("/admin/courses/new?error=" + encodeURIComponent(error.message));
  }

  redirect("/courses");
}

/**
 * Admin-only: permanently deletes a course, its documents and chunks
 * (cascade via foreign keys), and every storage object under the course's
 * prefix. Storage has no recursive delete, so each document's folder is
 * listed and removed individually before the row delete cascades.
 */
export async function deleteCourse(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!courseId) redirect("/courses");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/courses");

  const admin = createAdminClient();

  const { data: documents } = await admin
    .from("documents")
    .select("id")
    .eq("course_id", courseId);

  for (const doc of documents ?? []) {
    const prefix = `${courseId}/${doc.id}`;
    const { data: objects } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });
    if (objects && objects.length > 0) {
      await admin.storage
        .from(BUCKET)
        .remove(objects.map((object) => `${prefix}/${object.name}`));
    }
  }

  // Documents and chunks cascade via foreign keys once the course row goes.
  // Delete through the user-scoped client so RLS ("admins delete courses")
  // is the second line of defense, not the only one.
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) {
    redirect(`/courses/${courseId}?error=` + encodeURIComponent(error.message));
  }

  redirect("/courses");
}
