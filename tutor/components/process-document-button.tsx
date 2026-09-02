"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";

type Props = {
  documentId: string;
  courseId: string;
  category: string;
  status: string;
};

export default function ProcessDocumentButton({
  documentId,
  category,
  status,
}: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);

  const label =
    status === "ready" ? "Re-process" : status === "error" ? "Retry" : "Process";

  async function readError(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // Fall through to the generic message.
    }
    return `Request failed (${response.status}).`;
  }

  async function handleClick() {
    setError(null);
    setMissingKey(false);
    setProgress(null);

    const voyageKey = localStorage.getItem("tutor:voyage-key");
    // Voyage is optional — the server falls back to an admin-funded key.
    const hasVoyage = true; // always allow; server handles fallback
    const groqKey =
      category === "lecture_audio" ? localStorage.getItem("tutor:groq-key") : null;

    if (!hasVoyage || (category === "lecture_audio" && !groqKey)) {
      setMissingKey(true);
      return;
    }

    setWorking(true);
    try {
      if (category === "url_source") {
        setProgress("Processing…");
        const response = await fetch("/api/ingest/url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(voyageKey ? { "x-voyage-key": voyageKey } : {}),
          },
          body: JSON.stringify({ documentId }),
        });
        if (!response.ok) {
          setError(await readError(response));
          return;
        }
      } else if (category === "lecture_audio") {
        setProgress("Transcribing…");
        const response = await fetch("/api/ingest/audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(voyageKey ? { "x-voyage-key": voyageKey } : {}),
            "x-groq-key": groqKey!,
          },
          body: JSON.stringify({ documentId }),
        });
        if (!response.ok) {
          setError(await readError(response));
          return;
        }
      } else {
        let cursor = 0;
        setProgress("Processing…");
        for (;;) {
          const response = await fetch("/api/ingest/file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(voyageKey ? { "x-voyage-key": voyageKey } : {}),
            },
            body: JSON.stringify({ documentId, cursor }),
          });
          if (!response.ok) {
            setError(await readError(response));
            return;
          }
          const body = (await response.json()) as {
            done: boolean;
            nextCursor?: number;
            processed: number;
            total: number;
          };
          setProgress(`Processing… page ${body.processed} of ${body.total}`);
          if (body.done) break;
          cursor = body.nextCursor ?? body.processed;
        }
      }
      setProgress(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Processing failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={working}
        className={status === "error" ? "text-red-700" : undefined}
      >
        {working ? "Working…" : label}
      </Button>
      <span aria-live="polite" className="inline-flex items-center gap-1.5">
        {working && progress && (
          <>
            <Spinner className="size-3.5" />
            <span className="text-xs text-slate-500">{progress}</span>
          </>
        )}
      </span>
      {missingKey && (
        <span className="text-xs text-red-700">
          Missing API key — add it in{" "}
          <Link
            href="/settings/api-keys"
            className="underline hover:text-red-800"
          >
            Settings → API keys
          </Link>
          .
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
