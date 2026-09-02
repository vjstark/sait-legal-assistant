"use client";

/*
 * Course materials — shown as a full-width overlay below xl (this file's
 * MaterialsDrawer) and as a persistent column at xl+, immediately right of
 * the nav sidebar and left of the chat/quiz/flashcards panels (MaterialsColumn,
 * rendered by StudySession). Both wrap the same MaterialsList/MaterialsFooter
 * so the document list itself is defined once. Read-only for students;
 * admins/contributors get inline add/manage actions (see AddMaterialSection,
 * ProcessDocumentButton, withdrawDocument below) plus a link to the full
 * course page, where the review queue and danger-zone actions live.
 */

import { useEffect, useState } from "react";
import { withdrawDocument } from "@/app/actions/documents";
import ProcessDocumentButton from "@/components/process-document-button";
import { Badge, Button, ButtonLink, cn } from "@/components/ui";
import { AddMaterialSection } from "./add-material";

export type CourseDocument = {
  id: string;
  title: string;
  category: string;
  page_count: number | null;
  duration_seconds: number | null;
  status: string;
  review_status: string;
  uploaded_by: string | null;
};

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

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** The document list itself — shared by the overlay drawer and the persistent column. */
export function MaterialsList({
  documents,
  courseId,
  role,
  viewerId,
}: {
  documents: CourseDocument[];
  courseId: string;
  /** Viewer's role — gates the inline process/withdraw actions below. */
  role: string;
  viewerId: string | null;
}) {
  if (documents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No study material yet
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {documents.map((doc) => {
        const isPending = doc.review_status === "pending";
        const canProcess = role === "admin" && doc.review_status === "approved";
        const canWithdraw =
          role === "contributor" && isPending && doc.uploaded_by === viewerId;

        return (
          <li key={doc.id} className="rounded-lg border border-line px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-800">{doc.title}</span>
              <Badge tone={categoryTone(doc.category)}>
                {CATEGORY_LABELS[doc.category] ?? doc.category}
              </Badge>
              {doc.status !== "ready" && (
                <Badge tone={STATUS_TONES[doc.status] ?? "neutral"}>
                  {doc.status}
                </Badge>
              )}
              {isPending && <Badge tone="warning">Pending review</Badge>}
            </div>
            {(doc.page_count != null || doc.duration_seconds != null) && (
              <p className="mt-1 text-xs text-slate-500">
                {[
                  doc.page_count != null ? `${doc.page_count} pages` : null,
                  doc.duration_seconds != null
                    ? formatDuration(doc.duration_seconds)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {(canProcess || canWithdraw) && (
              <div className="mt-2">
                {canProcess && (
                  <ProcessDocumentButton
                    documentId={doc.id}
                    courseId={courseId}
                    category={doc.category}
                    status={doc.status}
                  />
                )}
                {canWithdraw && (
                  <form action={withdrawDocument}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Withdraw
                    </Button>
                  </form>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "View course page" (review queue / danger zone live there) plus a
 * secondary link to the full upload page — managing documents is now done
 * inline via AddMaterialSection/ProcessDocumentButton/withdrawDocument
 * above, so this is just an escape hatch, not the primary path.
 */
function MaterialsFooter({ courseId }: { courseId: string }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-5 py-4">
      <ButtonLink variant="secondary" size="sm" href={`/courses/${courseId}`}>
        View course page
      </ButtonLink>
      <ButtonLink variant="ghost" size="sm" href={`/admin/courses/${courseId}/upload`}>
        Full upload page
      </ButtonLink>
    </div>
  );
}

/** Persistent column shown at xl+ screens, immediately right of the nav sidebar and left of the study panels — in place of the overlay drawer. */
export function MaterialsColumn({
  documents,
  courseId,
  canManage,
  role,
  viewerId,
  onHide,
}: {
  documents: CourseDocument[];
  courseId: string;
  canManage: boolean;
  role: string;
  viewerId: string | null;
  /** Collapses the column (mirrors the page-header "Materials" pill, which reopens it). */
  onHide: () => void;
}) {
  return (
    <div className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface xl:flex">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-brand-900">Materials</h2>
          <Badge tone="neutral">{documents.length}</Badge>
        </div>
        <button
          type="button"
          onClick={onHide}
          aria-label="Hide materials"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {canManage && (
          <AddMaterialSection
            courseId={courseId}
            redirectTo={`/courses/${courseId}/chat`}
          />
        )}
        <MaterialsList
          documents={documents}
          courseId={courseId}
          role={role}
          viewerId={viewerId}
        />
      </div>
      {canManage && <MaterialsFooter courseId={courseId} />}
    </div>
  );
}

export function MaterialsDrawer({
  onClose,
  documents,
  courseId,
  canManage,
  role,
  viewerId,
}: {
  onClose: () => void;
  documents: CourseDocument[];
  courseId: string;
  canManage: boolean;
  role: string;
  viewerId: string | null;
}) {
  // The parent conditionally mounts this component, so every mount is a
  // fresh open — ease it in on the next tick so the transform/opacity
  // transition below has something to animate from (motion-safe only —
  // respects reduced-motion).
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close materials panel"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-brand-900/30 motion-safe:transition-opacity motion-safe:duration-200",
          entered ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Course materials"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface shadow-xl sm:max-w-sm",
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
          entered ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-brand-900">
            Materials ({documents.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {canManage && (
            <AddMaterialSection
              courseId={courseId}
              redirectTo={`/courses/${courseId}/chat`}
            />
          )}
          <MaterialsList
            documents={documents}
            courseId={courseId}
            role={role}
            viewerId={viewerId}
          />
        </div>

        {canManage && <MaterialsFooter courseId={courseId} />}
      </div>
    </div>
  );
}
