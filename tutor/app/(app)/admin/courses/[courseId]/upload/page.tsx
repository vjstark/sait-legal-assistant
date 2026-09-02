import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createUrlDocument, createNotesDocument } from "@/app/actions/documents";
import UploadFileForm from "@/components/upload-file-form";
import { UploadTabs } from "@/components/upload-tabs";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  PageHeader,
  Textarea,
} from "@/components/ui";

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { courseId } = await params;
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
  // Admins and contributors may add documents; contributor uploads land in
  // the review queue (see app/actions/documents.ts requireUploader) and
  // aren't visible to students until an admin approves them.
  if (profile?.role !== "admin" && profile?.role !== "contributor") {
    redirect("/courses");
  }
  const isContributor = profile.role === "contributor";

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

  return (
    <>
      <PageHeader
        title={`Add documents — ${course.name}`}
        description="Everything added here becomes searchable material the tutor can cite."
        backHref={`/courses/${courseId}`}
        backLabel="Back to course"
      />

      <div className="space-y-6">
        {isContributor && (
          <Alert tone="info">
            Your uploads go to the admin for review before students can see them.
          </Alert>
        )}
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

        <Card>
          <CardBody>
            <UploadTabs
              fileSection={
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Upload a file</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      PDFs, plain-text files, or lecture audio (transcribed, then
                      the audio is deleted).
                    </p>
                  </div>
                  <UploadFileForm courseId={courseId} />
                </div>
              }
              webSection={
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Add a web page</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Point at an article or resource online and it will be
                      fetched and indexed.
                    </p>
                  </div>
                  <form action={createUrlDocument} className="max-w-xl space-y-4">
                    <input type="hidden" name="courseId" value={courseId} />
                    <div>
                      <Label htmlFor="url-doc-url">URL</Label>
                      <Input
                        id="url-doc-url"
                        type="url"
                        name="url"
                        required
                        placeholder="https://…"
                      />
                    </div>
                    <div>
                      <Label htmlFor="url-doc-title">Title</Label>
                      <Input id="url-doc-title" type="text" name="title" required />
                    </div>
                    <Button type="submit" variant="secondary">
                      Add web page
                    </Button>
                  </form>
                </div>
              }
              notesSection={
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Paste notes</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Paste class notes or summaries as plain text.
                    </p>
                  </div>
                  <form action={createNotesDocument} className="max-w-xl space-y-4">
                    <input type="hidden" name="courseId" value={courseId} />
                    <div>
                      <Label htmlFor="notes-title">Title</Label>
                      <Input id="notes-title" type="text" name="title" required />
                    </div>
                    <div>
                      <Label htmlFor="notes-body">Notes</Label>
                      <Textarea id="notes-body" name="notes" required rows={12} />
                    </div>
                    <Button type="submit" variant="secondary">
                      Save notes
                    </Button>
                  </form>
                </div>
              }
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
