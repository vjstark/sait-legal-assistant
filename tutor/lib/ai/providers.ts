import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// ─────────────────────────────────────────────────────────────────
// Resolves which chat model to call from request headers, so every
// route (chat, quiz question, quiz grade, flashcards) picks the
// provider the same way. BYOK: the caller's own key travels in the
// header, never stored server-side.
//
// Header contract (set by components/study/shared.tsx):
//   x-chat-provider: "anthropic" | "gemini" — defaults to "anthropic"
//                     when the header is absent, so older clients
//                     that never send it keep working unchanged.
//   x-anthropic-key / x-gemini-key: the BYOK key for whichever
//                     provider is selected.
// ─────────────────────────────────────────────────────────────────

export type ChatProviderName = "Anthropic" | "Google Gemini";

export class MissingProviderKeyError extends Error {
  status = 400 as const;
  constructor(providerName: ChatProviderName) {
    super(`Add your ${providerName} key in Settings → API keys.`);
    this.name = "MissingProviderKeyError";
  }
}

// Verified 2026-09-02 against https://ai-gateway.vercel.sh/v1/models
// (google/* ids, prefix stripped for the direct provider): the
// current flash-tier Gemini model is gemini-3.7-flash. (gemini-3.8-flash
// also appears in that listing but its release date is today, so
// 3.7 — live for a few weeks — is the safer pick for a BYOK path we
// can't smoke-test against a real key here.)
const GEMINI_CHAT_MODEL_ID = "gemini-3.7-flash";
const ANTHROPIC_CHAT_MODEL_ID = "claude-sonnet-5";

export function resolveChatModel(headers: Headers): {
  model: LanguageModel;
  providerName: ChatProviderName;
} {
  const providerHeader = headers.get("x-chat-provider");
  const provider = providerHeader === "gemini" ? "gemini" : "anthropic";

  if (provider === "gemini") {
    const apiKey = headers.get("x-gemini-key");
    if (!apiKey) throw new MissingProviderKeyError("Google Gemini");
    const google = createGoogleGenerativeAI({ apiKey });
    return { model: google(GEMINI_CHAT_MODEL_ID), providerName: "Google Gemini" };
  }

  const apiKey = headers.get("x-anthropic-key");
  if (!apiKey) throw new MissingProviderKeyError("Anthropic");
  const anthropic = createAnthropic({ apiKey });
  return { model: anthropic(ANTHROPIC_CHAT_MODEL_ID), providerName: "Anthropic" };
}

/**
 * Maps a provider auth failure (401/403 from the model call) to a clear,
 * user-facing message naming the provider that rejected the key.
 * Returns null if `error` doesn't look like an auth failure.
 */
export function providerAuthErrorMessage(
  error: unknown,
  providerName: ChatProviderName,
): string | null {
  const status = (error as { statusCode?: number })?.statusCode;
  if (status === 401 || status === 403) {
    return `Your ${providerName} key was rejected — check it in Settings → API keys.`;
  }
  return null;
}
