"use client";

import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/components/ui";

/**
 * Shared Streamdown wrapper.
 *
 * This Streamdown version renders bare HTML elements with no built-in
 * classes, so typography is supplied here via the `components` override —
 * kept modest and matched to the app's design tokens rather than a generic
 * prose plugin. Streamdown itself handles incomplete/streaming markdown
 * safely, so this is used both for live-streaming chat text and for
 * fully-formed static content (the prompt-editor read view).
 *
 * `variant="chat"` fits inline assistant bubbles (compact, sans headings).
 * `variant="document"` fits a document-style read view (serif headings,
 * roomier spacing, not monospace).
 */
export function Markdown({
  children,
  className,
  isAnimating,
  variant = "chat",
}: {
  children: string;
  className?: string;
  isAnimating?: boolean;
  variant?: "chat" | "document";
}) {
  const isDoc = variant === "document";

  const components: NonNullable<ComponentProps<typeof Streamdown>["components"]> = {
    h1: ({ children: c, ...p }) => (
      <h1
        className={cn(
          "mb-2 mt-5 font-semibold text-brand-900 first:mt-0",
          isDoc ? "font-serif text-xl" : "text-base",
        )}
        {...p}
      >
        {c}
      </h1>
    ),
    h2: ({ children: c, ...p }) => (
      <h2
        className={cn(
          "mb-2 mt-5 font-semibold text-brand-900 first:mt-0",
          isDoc ? "font-serif text-lg" : "text-base",
        )}
        {...p}
      >
        {c}
      </h2>
    ),
    h3: ({ children: c, ...p }) => (
      <h3
        className={cn(
          "mb-1.5 mt-4 font-semibold text-brand-900 first:mt-0",
          isDoc ? "font-serif text-base" : "text-sm",
        )}
        {...p}
      >
        {c}
      </h3>
    ),
    p: ({ children: c, ...p }) => (
      <p className="my-2.5 first:mt-0 last:mb-0" {...p}>
        {c}
      </p>
    ),
    ul: ({ children: c, ...p }) => (
      <ul className="my-2.5 list-disc space-y-1 pl-5" {...p}>
        {c}
      </ul>
    ),
    ol: ({ children: c, ...p }) => (
      <ol className="my-2.5 list-decimal space-y-1 pl-5" {...p}>
        {c}
      </ol>
    ),
    strong: ({ children: c, ...p }) => (
      <strong className="font-semibold text-slate-900" {...p}>
        {c}
      </strong>
    ),
    code: ({ children: c, className: codeClassName, ...p }) => {
      if (!codeClassName) {
        return (
          <code
            className="rounded bg-brand-50 px-1 py-0.5 font-mono text-[0.85em] text-brand-900"
            {...p}
          >
            {c}
          </code>
        );
      }
      return (
        <code className={cn("font-mono text-[0.85em]", codeClassName)} {...p}>
          {c}
        </code>
      );
    },
    blockquote: ({ children: c, ...p }) => (
      <blockquote className="my-2.5 border-l-2 border-line pl-3 text-slate-500" {...p}>
        {c}
      </blockquote>
    ),
  };

  return (
    <Streamdown
      isAnimating={isAnimating}
      components={components}
      className={cn(
        "break-words text-sm leading-relaxed text-slate-700",
        isDoc && "text-[15px] leading-7",
        className,
      )}
    >
      {children}
    </Streamdown>
  );
}
