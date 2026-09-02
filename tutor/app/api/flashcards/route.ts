import { Output, generateText } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildFlashcardPrompt } from "@/lib/ai/prompts";
import { getPersonalityOverride } from "@/lib/ai/prompt-overrides";
import { retrieveChunks } from "@/lib/ai/tools";
import { VoyageError } from "@/lib/ai/voyage";
import { MissingProviderKeyError, providerAuthErrorMessage, resolveChatModel } from "@/lib/ai/providers";
import { resolveVoyageKey } from "@/lib/ai/voyage";

export const maxDuration = 60;

const cardsSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string(),
      back: z.string(),
      topic: z.string(),
    }),
  ),
});

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const voyageKey = resolveVoyageKey(request.headers);
  if (!voyageKey) {
    return jsonError("Missing Voyage API key — add it in Settings → API keys or ask the admin to enable the shared key.", 400);
  }

  let chatModel: ReturnType<typeof resolveChatModel>;
  try {
    chatModel = resolveChatModel(request.headers);
  } catch (error) {
    if (error instanceof MissingProviderKeyError) return jsonError(error.message, error.status);
    throw error;
  }
  const { model, providerName } = chatModel;

  let body: { courseId?: string; count?: number; topic?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const { courseId, topic } = body;
  if (!courseId) return jsonError("Expected { courseId, count?, topic? }.", 400);
  const count = Math.min(Math.max(Math.floor(Number(body.count) || 8), 1), 15);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("You must be signed in.", 401);

  const [{ data: course }, personalityOverride] = await Promise.all([
    supabase.from("courses").select("name").eq("id", courseId).single(),
    getPersonalityOverride(supabase, "flashcards"),
  ]);
  if (!course) return jsonError("Course not found.", 404);

  try {
    const chunks = await retrieveChunks({
      voyageKey,
      supabase,
      courseId,
      query: topic?.trim() || `key concepts, rules, and definitions in ${course.name}`,
      count: 12,
    });
    if (chunks.length === 0) {
      return jsonError(
        "No course material found to build flashcards from — an admin needs to upload materials first.",
        404,
      );
    }

    const result = await generateText({
      model,
      output: Output.object({ schema: cardsSchema }),
      prompt: buildFlashcardPrompt({
        courseName: course.name,
        topic: topic?.trim() || undefined,
        count,
        chunks: chunks.map(({ content, citation }) => ({ content, citation })),
        personalityOverride,
      }),
    });

    return Response.json(result.output);
  } catch (error) {
    if (error instanceof VoyageError) return jsonError(error.message, error.status);
    const authMessage = providerAuthErrorMessage(error, providerName);
    if (authMessage) return jsonError(authMessage, 401);
    return jsonError(error instanceof Error ? error.message : "Something went wrong.", 500);
  }
}
