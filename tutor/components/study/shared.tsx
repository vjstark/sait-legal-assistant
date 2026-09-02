"use client";

/*
 * Shared pieces for the study session panels: BYOK key helpers,
 * error/JSON plumbing, the missing-keys notice, feedback buttons,
 * and the small inline icons the panels use.
 */

import { useState } from "react";
import { Alert, ButtonLink, cn } from "@/components/ui";
import { recordMessageFeedback } from "@/app/actions/feedback";

const PROVIDER_KEY = "tutor:chat-provider";
const ANTHROPIC_KEY = "tutor:anthropic-key";
const GEMINI_KEY = "tutor:gemini-key";
const VOYAGE_KEY = "tutor:voyage-key";

// ─────────────────────────────────────────────────────────────────
// BYOK helpers — keys live only in this browser's localStorage.
// The chat provider is selectable (Anthropic by default, or Google
// Gemini); Voyage is optional and falls back to an admin-funded
// server key when not present.
// ─────────────────────────────────────────────────────────────────

type ChatProvider = "anthropic" | "gemini";

function readKeys(): { provider: ChatProvider; chatKey: string; voyage: string } {
  if (typeof window === "undefined") {
    return { provider: "anthropic", chatKey: "", voyage: "" };
  }
  const provider: ChatProvider =
    localStorage.getItem(PROVIDER_KEY) === "gemini" ? "gemini" : "anthropic";
  return {
    provider,
    chatKey:
      localStorage.getItem(provider === "gemini" ? GEMINI_KEY : ANTHROPIC_KEY) ?? "",
    voyage: localStorage.getItem(VOYAGE_KEY) ?? "",
  };
}

export function missingKeyNames(): string[] {
  const { provider, chatKey } = readKeys();
  const missing: string[] = [];
  if (!chatKey) missing.push(provider === "gemini" ? "Google Gemini" : "Anthropic");
  return missing;
}

export function keyHeaders(): Record<string, string> {
  const { provider, chatKey, voyage } = readKeys();
  return {
    "x-voyage-key": voyage,
    "x-chat-provider": provider,
    [provider === "gemini" ? "x-gemini-key" : "x-anthropic-key"]: chatKey,
  };
}

/** API errors arrive as JSON `{error}` — dig the message out if possible. */
export function errorText(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw);
  try {
    const parsed = JSON.parse(message) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // not JSON — use as-is
  }
  return message;
}

export async function postJson<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...keyHeaders() },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok || !json) {
    throw new Error(json?.error ?? `Request failed (${response.status}).`);
  }
  return json;
}

// ─────────────────────────────────────────────────────────────────
// Missing-keys notice
// ─────────────────────────────────────────────────────────────────

export function MissingKeysNotice({ missing }: { missing: string[] }) {
  return (
    <Alert tone="info">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p>
          Your {missing.join(" and ")} API key
          {missing.length > 1 ? "s are" : " is"} not set, so requests can’t be
          sent yet.
        </p>
        <ButtonLink href="/settings/api-keys" variant="secondary" size="sm">
          Add {missing.length > 1 ? "keys" : "key"} in Settings
        </ButtonLink>
      </div>
    </Alert>
  );
}

// ─────────────────────────────────────────────────────────────────
// Inline icons
// ─────────────────────────────────────────────────────────────────

type IconProps = { className?: string };

export function SearchIcon({ className }: IconProps) {
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
      <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
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
      <path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v17.25" />
    </svg>
  );
}

function ThumbUpIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6.6 10.2c.8 0 1.53-.44 2.03-1.08a9 9 0 0 1 2.86-2.4c.72-.38 1.35-.95 1.65-1.71.21-.54.32-1.1.32-1.68v-.58a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.15-.26 2.24-.72 3.22-.27.56.1 1.28.72 1.28h3.13c1.02 0 1.94.7 2.05 1.72.05.42.07.85.07 1.28a11.95 11.95 0 0 1-2.65 7.52c-.39.48-.99.73-1.6.73h-4.02c-.48 0-.96-.08-1.42-.23l-3.12-1.04a4.5 4.5 0 0 0-1.42-.23h-.85" />
      <path d="M5.9 9.5c-.55 1.4-.85 2.92-.85 4.5 0 1.25.19 2.46.53 3.6.26.85 1.08 1.4 1.97 1.4h.93c.44 0 .72-.5.52-.9a9 9 0 0 1-.35-7.7c.24-.4-.03-.9-.5-.9H7.1c-.52 0-1 .28-1.2.75Z" />
    </svg>
  );
}

function ThumbDownIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17.4 13.8c-.8 0-1.53.44-2.03 1.08a9 9 0 0 1-2.86 2.4c-.72.38-1.35.95-1.65 1.71-.21.54-.32 1.1-.32 1.68v.58a.75.75 0 0 1-.75.75 2.25 2.25 0 0 1-2.25-2.25c0-1.15.26-2.24.72-3.22.27-.56-.1-1.28-.72-1.28H4.41c-1.02 0-1.94-.7-2.05-1.72A12.14 12.14 0 0 1 2.29 12c0-2.85.99-5.46 2.65-7.52.39-.48.99-.73 1.6-.73h4.02c.48 0 .96.08 1.42.23l3.12 1.04c.46.15.94.23 1.42.23h.85" />
      <path d="M18.1 14.5c.55-1.4.85-2.92.85-4.5 0-1.25-.19-2.46-.53-3.6-.26-.85-1.08-1.4-1.97-1.4h-.93c-.44 0-.72.5-.52.9a9 9 0 0 1 .35 7.7c-.24.4.03.9.5.9h1.05c.52 0 1-.28 1.2-.75Z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// Feedback (👍/👎) — same recordMessageFeedback wiring as before.
// ─────────────────────────────────────────────────────────────────

export function FeedbackButtons({
  courseId,
  mode,
  topic,
}: {
  courseId: string;
  mode: "teach" | "lookup" | "quiz";
  topic?: string | null;
}) {
  const [given, setGiven] = useState<"up" | "down" | null>(null);

  const give = (rating: "up" | "down") => {
    setGiven(rating);
    void recordMessageFeedback({ courseId, mode, topic: topic ?? null, rating });
  };

  const base =
    "inline-flex size-7 touch-manipulation items-center justify-center rounded-md transition-colors " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 " +
    "disabled:cursor-not-allowed";

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Helpful"
        aria-pressed={given === "up"}
        disabled={given !== null}
        onClick={() => give("up")}
        className={cn(
          base,
          given === "up"
            ? "bg-brand-100 text-brand-700"
            : "text-slate-400 hover:bg-brand-50 hover:text-brand-700",
          given === "down" && "opacity-40",
        )}
      >
        <ThumbUpIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Not helpful"
        aria-pressed={given === "down"}
        disabled={given !== null}
        onClick={() => give("down")}
        className={cn(
          base,
          given === "down"
            ? "bg-accent-100 text-accent-700"
            : "text-slate-400 hover:bg-brand-50 hover:text-brand-700",
          given === "up" && "opacity-40",
        )}
      >
        <ThumbDownIcon className="size-4" />
      </button>
    </span>
  );
}
