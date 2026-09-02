"use client";

/*
 * Compact "add material" flows for the study screen's materials panel —
 * the same three add paths as the full upload page (app/(app)/admin/
 * courses/[courseId]/upload/page.tsx), condensed to fit an 18rem column
 * and wired to stay on the current page instead of navigating away.
 */

import { useState } from "react";
import { createNotesDocument, createUrlDocument } from "@/app/actions/documents";
import UploadFileForm from "@/components/upload-file-form";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

type AddTab = "file" | "web" | "notes";

const TABS: { id: AddTab; label: string }[] = [
  { id: "file", label: "Upload a file" },
  { id: "web", label: "Add a web page" },
  { id: "notes", label: "Paste notes" },
];

export function AddMaterialSection({
  courseId,
  redirectTo,
}: {
  courseId: string;
  /** In-app path the two server-action forms should land back on after success. */
  redirectTo: string;
}) {
  // Collapsed by default so the panel opens on the document list, not a
  // form — matches NotebookLM's sources panel. The two redirect-based forms
  // below (web page, notes) land back on `redirectTo` via a server redirect,
  // which remounts this component and naturally resets `expanded`; the file
  // form stays on the page (stayOnPage), so it collapses itself explicitly
  // via onSuccess.
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<AddTab>("file");

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setExpanded(true)}
        className="w-full"
      >
        + Add material
      </Button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="add-material-kind" className="mb-0">
          Type
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
          className="-mr-1"
        >
          Cancel
        </Button>
      </div>
      <Select
        id="add-material-kind"
        value={tab}
        onChange={(event) => setTab(event.target.value as AddTab)}
      >
        {TABS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </Select>

      {tab === "file" && (
        <UploadFileForm
          courseId={courseId}
          stayOnPage
          compact
          onSuccess={() => setExpanded(false)}
        />
      )}

      {tab === "web" && (
        <form action={createUrlDocument} className="space-y-2.5">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="_redirect" value={redirectTo} />
          <div>
            <Label htmlFor="m-url-doc-url">URL</Label>
            <Input id="m-url-doc-url" type="url" name="url" required placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="m-url-doc-title">Title</Label>
            <Input id="m-url-doc-title" type="text" name="title" required />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Add web page
          </Button>
        </form>
      )}

      {tab === "notes" && (
        <form action={createNotesDocument} className="space-y-2.5">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="_redirect" value={redirectTo} />
          <div>
            <Label htmlFor="m-notes-title">Title</Label>
            <Input id="m-notes-title" type="text" name="title" required />
          </div>
          <div>
            <Label htmlFor="m-notes-body">Notes</Label>
            <Textarea id="m-notes-body" name="notes" required rows={4} />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Save notes
          </Button>
        </form>
      )}
    </div>
  );
}
