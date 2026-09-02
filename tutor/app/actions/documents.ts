"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "course-files";

// Categories a browser file upload may register as. url_source is excluded —
// those rows are created by createUrlDocument and have no storage object.
const UPLOAD_CATEGORIES = [
  "textbook",
  "supplementary_pdf",
  "lecture_slides",
  "lecture_audio",
  "past_exam",
  "personal_notes",
] as const;

/**
 * Verifies the caller is signed in and an admin using the user-scoped
 * client. Redirects to /login when signed out; returns null (instead of
 * redirecting) when signed in but not an admin, so callers can surface
 * the failure however fits them.
 */
async function requireAdmin() {
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
  if (profile?.role !== "admin") return null;

  return { supabase, user };
}

/**
 * Like requireAdmin, but accepts contributors too — the two roles that may
 * add documents. Returns the caller's role so inserts can force contributor
 * uploads into the review queue (review_status 'pending'), matching the
 * documents insert RLS with-check.
 */
async function requireUploader() {
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
  const role = profile?.role;
  if (role !== "admin" && role !== "contributor") return null;

  return { supabase, user, role: role as "admin" | "contributor" };
}

/**
 * Called from the browser after the file itself has already been uploaded
 * to storage by the client-side supabase client (storage RLS limits that
 * to admins and contributors). Inserts the documents row. Returns { error }
 * instead of redirecting so the upload form can show failures inline.
 */
export async function registerUploadedDocument(input: {
  documentId: string;
  courseId: string;
  title: string;
  category: string;
  storagePath: string;
  sourceFilename: string;
}): Promise<{ error?: string }> {
  const auth = await requireUploader();
  if (!auth) return { error: "Only admins and contributors can add documents." };

  const { documentId, courseId, category, storagePath, sourceFilename } = input;
  const title = input.title.trim();

  if (!title) return { error: "Title is required." };
  if (!(UPLOAD_CATEGORIES as readonly string[]).includes(category)) {
    return { error: `Invalid category: ${category}` };
  }
  if (!storagePath.startsWith(`${courseId}/${documentId}/`)) {
    return { error: "Storage path does not match the course and document ids." };
  }

  const { error } = await auth.supabase.from("documents").insert({
    id: documentId,
    course_id: courseId,
    title,
    category,
    storage_path: storagePath,
    source_filename: sourceFilename,
    status: "uploaded",
    uploaded_by: auth.user.id,
    // Contributor uploads enter the review queue; the insert RLS with-check
    // requires this. Admin inserts keep the column default ('approved').
    ...(auth.role === "contributor" ? { review_status: "pending" } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath(`/courses/${courseId}`);
  return {};
}

export async function createUrlDocument(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  // Callers (e.g. the inline study-screen form) may ask to land back on
  // their own page instead of the course page — only an in-app path is
  // honored, never an external URL.
  const requestedRedirect = String(formData.get("_redirect") ?? "").trim();
  const successPath = requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
    ? requestedRedirect
    : `/courses/${courseId}`;
  const errorBack = (message: string): never =>
    redirect(
      `/admin/courses/${courseId}/upload?error=` + encodeURIComponent(message),
    );

  const auth = await requireUploader();
  if (!auth) redirect("/courses");

  if (!url) errorBack("URL is required.");
  if (!title) errorBack("Title is required.");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    errorBack("That doesn't look like a valid http(s) URL.");
  }

  const { error } = await auth.supabase.from("documents").insert({
    course_id: courseId,
    title,
    category: "url_source",
    source_url: url,
    status: "uploaded",
    uploaded_by: auth.user.id,
    ...(auth.role === "contributor" ? { review_status: "pending" } : {}),
  });
  if (error) errorBack(error.message);

  revalidatePath(`/courses/${courseId}`);
  if (successPath !== `/courses/${courseId}`) revalidatePath(successPath);
  redirect(successPath);
}

export async function createNotesDocument(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "");
  const requestedRedirect = String(formData.get("_redirect") ?? "").trim();
  const successPath = requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
    ? requestedRedirect
    : `/courses/${courseId}`;
  const errorBack = (message: string): never =>
    redirect(
      `/admin/courses/${courseId}/upload?error=` + encodeURIComponent(message),
    );

  const auth = await requireUploader();
  if (!auth) redirect("/courses");

  if (!title) errorBack("Title is required.");
  if (!notes.trim()) errorBack("Notes are empty.");

  const documentId = crypto.randomUUID();
  const storagePath = `${courseId}/${documentId}/notes.txt`;

  // Pasted text is small, so uploading from the server is fine here.
  // The admin client is safe: requireUploader() has already verified the caller.
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(notes, "utf8"), {
      contentType: "text/plain",
    });
  if (uploadError) errorBack(uploadError.message);

  const { error: insertError } = await auth.supabase.from("documents").insert({
    id: documentId,
    course_id: courseId,
    title,
    category: "personal_notes",
    storage_path: storagePath,
    source_filename: "notes.txt",
    status: "uploaded",
    uploaded_by: auth.user.id,
    ...(auth.role === "contributor" ? { review_status: "pending" } : {}),
  });
  if (insertError) {
    // Don't leave an orphaned object behind the failed row.
    await admin.storage.from(BUCKET).remove([storagePath]);
    errorBack(insertError.message);
  }

  revalidatePath(`/courses/${courseId}`);
  if (successPath !== `/courses/${courseId}`) revalidatePath(successPath);
  redirect(successPath);
}

export async function deleteDocument(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();

  const auth = await requireAdmin();
  if (!auth) redirect("/courses");
  if (!documentId) redirect("/courses");

  const { data: doc } = await auth.supabase
    .from("documents")
    .select("id, course_id")
    .eq("id", documentId)
    .single();
  if (!doc) redirect("/courses");

  const courseId = doc.course_id as string;
  const errorBack = (message: string): never =>
    redirect(`/courses/${courseId}?error=` + encodeURIComponent(message));

  // Remove any storage objects under this document's prefix first.
  const admin = createAdminClient();
  const prefix = `${courseId}/${documentId}`;
  const { data: objects, error: listError } = await admin.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (listError) errorBack(listError.message);
  if (objects && objects.length > 0) {
    const { error: removeError } = await admin.storage
      .from(BUCKET)
      .remove(objects.map((object) => `${prefix}/${object.name}`));
    if (removeError) errorBack(removeError.message);
  }

  // Chunks cascade via the documents_id foreign key.
  const { error: deleteError } = await auth.supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (deleteError) errorBack(deleteError.message);

  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

/**
 * Admin-only: moves a pending contributor upload into the approved queue so
 * students can see it and admins can process it.
 */
export async function approveDocument(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();

  const auth = await requireAdmin();
  if (!auth) redirect("/courses");
  if (!documentId) redirect("/courses");

  const { data: doc } = await auth.supabase
    .from("documents")
    .select("id, course_id")
    .eq("id", documentId)
    .single();
  if (!doc) redirect("/courses");

  const courseId = doc.course_id as string;
  const errorBack = (message: string): never =>
    redirect(`/courses/${courseId}?error=` + encodeURIComponent(message));

  const { error } = await auth.supabase
    .from("documents")
    .update({ review_status: "approved" })
    .eq("id", documentId);
  if (error) errorBack(error.message);

  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

/**
 * Admin-only: rejects a pending contributor upload. Like deleteDocument,
 * this removes the row and its storage objects entirely — rejection isn't
 * a status the contributor can resubmit from, it's a clean removal.
 */
export async function rejectDocument(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();

  const auth = await requireAdmin();
  if (!auth) redirect("/courses");
  if (!documentId) redirect("/courses");

  const { data: doc } = await auth.supabase
    .from("documents")
    .select("id, course_id")
    .eq("id", documentId)
    .single();
  if (!doc) redirect("/courses");

  const courseId = doc.course_id as string;
  const errorBack = (message: string): never =>
    redirect(`/courses/${courseId}?error=` + encodeURIComponent(message));

  const admin = createAdminClient();
  const prefix = `${courseId}/${documentId}`;
  const { data: objects, error: listError } = await admin.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (listError) errorBack(listError.message);
  if (objects && objects.length > 0) {
    const { error: removeError } = await admin.storage
      .from(BUCKET)
      .remove(objects.map((object) => `${prefix}/${object.name}`));
    if (removeError) errorBack(removeError.message);
  }

  const { error: deleteError } = await auth.supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (deleteError) errorBack(deleteError.message);

  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

/**
 * A contributor withdrawing their own still-pending upload. Ownership and
 * pending-ness are checked explicitly against a user-scoped read first; the
 * row delete also goes through the user-scoped client so RLS ("contributors
 * delete own pending documents") is the second line of defense, not the
 * only one.
 */
export async function withdrawDocument(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!documentId) redirect("/courses");

  const { data: doc } = await supabase
    .from("documents")
    .select("id, course_id, uploaded_by, review_status")
    .eq("id", documentId)
    .single();
  if (!doc) redirect("/courses");

  const courseId = doc.course_id as string;
  const errorBack = (message: string): never =>
    redirect(`/courses/${courseId}?error=` + encodeURIComponent(message));

  if (doc.uploaded_by !== user.id || doc.review_status !== "pending") {
    errorBack("You can only withdraw your own uploads that are still pending review.");
  }

  // Remove any storage objects under this document's prefix first.
  const admin = createAdminClient();
  const prefix = `${courseId}/${documentId}`;
  const { data: objects, error: listError } = await admin.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (listError) errorBack(listError.message);
  if (objects && objects.length > 0) {
    const { error: removeError } = await admin.storage
      .from(BUCKET)
      .remove(objects.map((object) => `${prefix}/${object.name}`));
    if (removeError) errorBack(removeError.message);
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (deleteError) errorBack(deleteError.message);

  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}
