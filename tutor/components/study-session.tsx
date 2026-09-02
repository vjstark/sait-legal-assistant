"use client";

/*
 * Study session shell — course switcher, materials drawer, the mode
 * switcher, and the active panel. The panels live in components/study/.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui";
import { ChatPanel } from "./study/chat-panel";
import { QuizPanel } from "./study/quiz-panel";
import { FlashcardsPanel } from "./study/flashcards-panel";
import {
  MaterialsColumn,
  MaterialsDrawer,
  type CourseDocument,
} from "./study/materials-drawer";

type Mode = "teach" | "lookup" | "quiz" | "flashcards";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const MODES: { id: Mode; label: string; description: string }[] = [
  {
    id: "teach",
    label: "Teach me",
    description: "A patient tutor that walks you through concepts step by step.",
  },
  {
    id: "lookup",
    label: "Look it up",
    description: "Direct answers with citations from your course materials.",
  },
  {
    id: "quiz",
    label: "Quiz me",
    description: "Exam-style questions, graded with detailed feedback.",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    description: "Quick self-testing on any topic — rate each card as you go.",
  },
];

export function StudySession({
  courseId,
  courseName,
  courses = [],
  documents = [],
  role = "student",
  viewerId = null,
}: {
  courseId: string;
  courseName: string;
  courses?: { id: string; name: string }[];
  documents?: CourseDocument[];
  role?: string;
  viewerId?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("teach");
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const isChat = mode === "teach" || mode === "lookup";
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];
  const canManage = role === "admin" || role === "contributor";

  // The materials panel is a persistent column at xl+ and an overlay drawer
  // below it. It should default to visible on xl+ and closed below — check
  // once on mount (not a live resize sync; the toggle button owns it after
  // that, same as the button controlling the overlay before this changed).
  useEffect(() => {
    // Reads a browser API (matchMedia) that isn't available during SSR, so
    // this can't be derived during render — an effect is the correct tool
    // here, and it only runs once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMaterialsOpen(window.matchMedia("(min-width: 1280px)").matches);
  }, []);

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        // Fill the viewport under the sticky nav (h-14) and main padding
        // (py-8) so the conversation scrolls and the composer stays pinned.
        // This wraps the header too (as before) so the header's own height
        // is subtracted from what the panel row gets, via flex-1 below.
        isChat && "h-[calc(100dvh-7.5rem)] min-h-[26rem]",
      )}
    >
      <header className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="course-switcher" className="sr-only">
              Switch course
            </label>
            {courses.length > 0 ? (
              <div className="relative -ml-2 inline-flex max-w-full items-center rounded-lg px-2 py-0.5 transition-colors hover:bg-brand-50">
                <select
                  id="course-switcher"
                  value={courseId}
                  onChange={(event) => router.push(`/courses/${event.target.value}/chat`)}
                  className="max-w-full cursor-pointer appearance-none truncate text-balance bg-transparent pr-6 text-2xl font-semibold text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-2 size-4 text-brand-700" />
              </div>
            ) : (
              <h1 className="text-balance text-2xl font-semibold">{courseName}</h1>
            )}
          </div>
          <button
            type="button"
            aria-expanded={materialsOpen}
            onClick={() => setMaterialsOpen((open) => !open)}
            className="inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-brand-800 transition-colors hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
          >
            Materials ({documents.length})
          </button>
        </div>
        <div className="mt-5 overflow-x-auto" role="group" aria-label="Study mode">
          <div className="inline-flex whitespace-nowrap rounded-full border border-line bg-brand-50 p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "touch-manipulation rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800",
                  mode === m.id
                    ? "bg-surface text-brand-900 shadow-sm"
                    : "text-slate-500 hover:text-brand-800",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2.5 text-sm text-slate-500">{active.description}</p>
      </header>

      {/* Panels + the xl+ persistent column share this row; the column is
          the second column overall (right after the app shell's nav
          sidebar, left of the study panels) and stretches to match the
          panel area's height (fixed in chat modes, intrinsic otherwise)
          via the default flex stretch behavior. */}
      <div className="flex min-h-0 flex-1">
        {materialsOpen && (
          <MaterialsColumn
            documents={documents}
            courseId={courseId}
            canManage={canManage}
            role={role}
            viewerId={viewerId}
            onHide={() => setMaterialsOpen(false)}
          />
        )}

        <div className="mx-auto flex w-full min-w-0 max-w-3xl min-h-0 flex-1 flex-col">
          {mode === "teach" && <ChatPanel key="teach" courseId={courseId} mode="teach" />}
          {mode === "lookup" && <ChatPanel key="lookup" courseId={courseId} mode="lookup" />}
          {mode === "quiz" && <QuizPanel courseId={courseId} />}
          {mode === "flashcards" && <FlashcardsPanel courseId={courseId} />}
        </div>
      </div>

      {materialsOpen && (
        <div className="xl:hidden">
          <MaterialsDrawer
            onClose={() => setMaterialsOpen(false)}
            documents={documents}
            courseId={courseId}
            canManage={canManage}
            role={role}
            viewerId={viewerId}
          />
        </div>
      )}
    </div>
  );
}
