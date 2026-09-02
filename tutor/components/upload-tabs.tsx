"use client";

/*
 * Tab bar for the Add-documents page. Purely presentational — each
 * section is handed in as a server-rendered child (the two server-action
 * forms stay server components; only the tab chrome is client-side) and
 * all three stay mounted so form state survives switching tabs.
 */

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui";

type TabId = "file" | "web" | "notes";

const TABS: { id: TabId; label: string }[] = [
  { id: "file", label: "Upload a file" },
  { id: "web", label: "Add a web page" },
  { id: "notes", label: "Paste notes" },
];

export function UploadTabs({
  fileSection,
  webSection,
  notesSection,
}: {
  fileSection: ReactNode;
  webSection: ReactNode;
  notesSection: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("file");

  return (
    <div>
      <div
        role="group"
        aria-label="Add documents"
        className="inline-flex flex-wrap rounded-full border border-line bg-brand-50 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "touch-manipulation rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800",
              tab === t.id
                ? "bg-surface text-brand-900 shadow-sm"
                : "text-slate-500 hover:text-brand-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div hidden={tab !== "file"}>{fileSection}</div>
        <div hidden={tab !== "web"}>{webSection}</div>
        <div hidden={tab !== "notes"}>{notesSection}</div>
      </div>
    </div>
  );
}
