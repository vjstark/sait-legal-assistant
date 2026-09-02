import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  approveDocument,
  deleteDocument,
  rejectDocument,
  withdrawDocument,
} from "@/app/actions/documents";
import ProcessDocumentButton from "@/components/process-document-button";
import DeleteCourseButton from "@/components/delete-course-button";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
} from "@/components/ui";

const CATEGORY_LABELS: Record<string, string> = {
  textbook: "Textbook",
  supplementary_pdf: "Supplementary PDF",
  lecture_slides: "Lecture slides",
  lecture_audio: "Lecture audio",
  past_exam: "Past exam",
  personal_notes: "Personal notes",
  url_source: "Web page",
};

const STATUS_TONES: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  uploaded: "neutral",
  processing: "warning",
  ready: "success",
  error: "danger",
};

function categoryTone(category: string): "brand" | "accent" | "neutral" {
  if (category === "textbook") return "brand";
  if (category === "past_exam") return "accent";
  return "neutral";
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default async function CoursePage({
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

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, code, term")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

  const [{ data: profile }, { data: documents }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("documents")
      .select(
        "id, title, category, status, review_status, page_count, duration_seconds, created_at, uploaded_by",
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false }),
  ]);
  const isAdmin = profile?.role === "admin";
  const isContributor = profile?.role === "contributor";

  const allDocuments = documents ?? [];
  const approvedDocuments = allDocuments.filter((doc) => doc.review_status === "approved");
  const pendingDocuments = allDocuments.filter((doc) => doc.review_status === "pending");
  const myPendingDocuments = pendingDocuments.filter((doc) => doc.uploaded_by === user.id);

  // Admins reviewing the queue need to know who uploaded each pending doc —
  // a second query since documents doesn't carry the uploader's name.
  let uploaderNames: Record<string, string> = {};
  if (isAdmin && pendingDocuments.length > 0) {
    const uploaderIds = [
      ...new Set(pendingDocuments.map((doc) => doc.uploaded_by).filter((id): id is string => Boolean(id))),
    ];
    const { data: uploaders } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", uploaderIds);
    uploaderNames = Object.fromEntries(
      (uploaders ?? []).map((u) => [u.id, u.display_name || u.email]),
    );
  }

  const canUpload = isAdmin || isContributor;

  return (
    <>
      <PageHeader
        title={course.name}
        description={[course.code, course.term].filter(Boolean).join(" · ") || undefined}
        backHref="/courses"
        backLabel="Courses"
        actions={
          <>
            <ButtonLink variant="primary" href={`/courses/${courseId}/chat`}>
              Study →
            </ButtonLink>
            <ButtonLink variant="secondary" href={`/courses/${courseId}/progress`}>
              Progress
            </ButtonLink>
            {canUpload && (
              <ButtonLink
                variant="secondary"
                href={`/admin/courses/${courseId}/upload`}
              >
                Add documents
              </ButtonLink>
            )}
          </>
        }
      />

      {errorMessage && (
        <Alert tone="error" className="mb-6">
          {errorMessage}
        </Alert>
      )}

      {isAdmin && pendingDocuments.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl">Review queue</h2>
          <Card>
            <ul className="divide-y divide-line">
              {pendingDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{doc.title}</span>
                      <Badge tone={categoryTone(doc.category)}>
                        {CATEGORY_LABELS[doc.category] ?? doc.category}
                      </Badge>
                      <Badge tone="warning">pending review</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {[
                        doc.uploaded_by
                          ? `uploaded by ${uploaderNames[doc.uploaded_by] ?? "unknown"}`
                          : null,
                        `added ${new Date(doc.created_at).toLocaleDateString()}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={approveDocument} className="inline">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <Button type="submit" variant="primary" size="sm">
                        Approve
                      </Button>
                    </form>
                    <form action={rejectDocument} className="inline">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Reject
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <h2 className="mb-3 text-xl">Documents</h2>
      {approvedDocuments.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {approvedDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{doc.title}</span>
                    <Badge tone={categoryTone(doc.category)}>
                      {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </Badge>
                    <Badge tone={STATUS_TONES[doc.status] ?? "neutral"}>
                      {doc.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[
                      doc.page_count != null ? `${doc.page_count} pages` : null,
                      doc.duration_seconds != null
                        ? formatDuration(doc.duration_seconds)
                        : null,
                      `added ${new Date(doc.created_at).toLocaleDateString()}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ProcessDocumentButton
                      documentId={doc.id}
                      courseId={courseId}
                      category={doc.category}
                      status={doc.status}
                    />
                    <form action={deleteDocument} className="inline">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Delete
                      </Button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : canUpload ? (
        <EmptyState
          title="No documents yet"
          description="Upload textbooks, slides, audio, or past exams to power study sessions."
          action={
            <ButtonLink
              variant="secondary"
              href={`/admin/courses/${courseId}/upload`}
            >
              Add documents
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          title="No documents yet"
          description="Course material is on its way — check back soon."
        />
      )}

      {isContributor && myPendingDocuments.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl">Your uploads awaiting review</h2>
          <Card>
            <ul className="divide-y divide-line">
              {myPendingDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{doc.title}</span>
                      <Badge tone={categoryTone(doc.category)}>
                        {CATEGORY_LABELS[doc.category] ?? doc.category}
                      </Badge>
                      <Badge tone="warning">pending review</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      added {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <form action={withdrawDocument} className="inline">
                    <input type="hidden" name="documentId" value={doc.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      Withdraw
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {isAdmin && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="mb-3 text-xl">Danger zone</h2>
          <Card className="border-red-200">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-sm text-slate-600">
                Permanently delete this course, its documents, and all study
                material. This cannot be undone.
              </p>
              <DeleteCourseButton courseId={courseId} />
            </CardBody>
          </Card>
        </section>
      )}
    </>
  );
}
