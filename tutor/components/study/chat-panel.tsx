"use client";

/*
 * Chat panel — "Teach me" and "Look it up" modes.
 * The conversation is the hero: messages fill the panel and scroll,
 * the composer stays pinned at the bottom.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Alert, cn } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import {
  ArrowUpIcon,
  errorText,
  FeedbackButtons,
  keyHeaders,
  missingKeyNames,
  MissingKeysNotice,
  SearchIcon,
} from "./shared";

const EXAMPLE_QUESTIONS: Record<"teach" | "lookup", string[]> = {
  teach: [
    "Teach me my weakest topic",
    "Walk me through this week’s key concepts",
    "Explain a tricky doctrine with an example",
  ],
  lookup: [
    "Where do my materials cover this topic?",
    "Define a key term from the readings",
    "Summarize the leading case on a topic",
  ],
};

function ToolActivity({ label, pending }: { label: string; pending: boolean }) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs text-slate-400",
        pending && "motion-safe:animate-pulse",
      )}
    >
      <SearchIcon className="size-3.5 shrink-0" />
      {label}
    </p>
  );
}

function TypingDots() {
  return (
    <p className="flex items-center gap-1 py-1" role="status" aria-label="Tutor is responding">
      <span className="size-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.32s]" />
      <span className="size-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.16s]" />
      <span className="size-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce" />
    </p>
  );
}

export function ChatPanel({
  courseId,
  mode,
}: {
  courseId: string;
  mode: "teach" | "lookup";
}) {
  const [input, setInput] = useState("");
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => keyHeaders(),
        body: () => ({ mode, courseId }),
      }),
    [mode, courseId],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  // Keep the newest message in view (instant — no motion concerns).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    const missing = missingKeyNames();
    if (missing.length > 0) {
      setMissingKeys(missing);
      return;
    }
    setMissingKeys([]);
    void sendMessage({ text });
    setInput("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <SearchIcon className="size-5" />
            </span>
            <p className="max-w-sm text-balance font-serif text-lg leading-relaxed text-brand-900">
              Ask anything about this course — answers cite your actual materials
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS[mode].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setInput(example);
                    inputRef.current?.focus();
                  }}
                  className="touch-manipulation rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              const isStreamingThis = busy && index === messages.length - 1;

              if (!isAssistant) {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] break-words rounded-2xl rounded-br-md bg-brand-800 px-4 py-2.5 text-sm leading-6 text-white sm:max-w-[75%]">
                      <span className="sr-only">You said: </span>
                      {message.parts.map((part, partIndex) =>
                        part.type === "text" ? (
                          <p key={partIndex} className="whitespace-pre-wrap">
                            {part.text}
                          </p>
                        ) : null,
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className="space-y-2">
                  <span className="sr-only">Tutor said: </span>
                  {message.parts.map((part, partIndex) => {
                    if (part.type === "text") {
                      return (
                        <Markdown key={partIndex} isAnimating={isStreamingThis} className="max-w-prose">
                          {part.text}
                        </Markdown>
                      );
                    }
                    if (part.type === "tool-findRelevantContent") {
                      return (
                        <ToolActivity
                          key={partIndex}
                          label="Searched course material…"
                          pending={
                            part.state === "input-streaming" ||
                            part.state === "input-available"
                          }
                        />
                      );
                    }
                    if (part.type === "tool-getWeakTopics") {
                      return (
                        <ToolActivity
                          key={partIndex}
                          label="Checked your quiz history…"
                          pending={
                            part.state === "input-streaming" ||
                            part.state === "input-available"
                          }
                        />
                      );
                    }
                    return null;
                  })}
                  {!isStreamingThis && (
                    <FeedbackButtons courseId={courseId} mode={mode} topic={null} />
                  )}
                </div>
              );
            })}
            {busy && <TypingDots />}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3">
        {error && <Alert tone="error">{errorText(error)}</Alert>}
        {missingKeys.length > 0 && <MissingKeysNotice missing={missingKeys} />}

        <form
          onSubmit={submit}
          className="flex items-end gap-2 rounded-xl border border-line bg-surface p-2 shadow-sm transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/15"
        >
          <label htmlFor="chat-input" className="sr-only">
            {mode === "teach" ? "What should we work on?" : "Ask a question"}
          </label>
          <div className="grid min-w-0 flex-1">
            <div
              aria-hidden
              className="pointer-events-none invisible max-h-40 overflow-hidden whitespace-pre-wrap break-words px-2 py-1.5 text-sm leading-6 [grid-area:1/1]"
            >
              {input + " "}
            </div>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={mode === "teach" ? "What should we work on?" : "Ask a question…"}
              className="max-h-40 w-full resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:outline-none [grid-area:1/1]"
            />
          </div>
          <button
            type="submit"
            aria-label="Send"
            disabled={busy || !input.trim()}
            className="inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-full bg-brand-800 text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:bg-brand-800/40"
          >
            <ArrowUpIcon className="size-4" />
          </button>
        </form>
        <p className="text-center text-[11px] text-slate-400">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
