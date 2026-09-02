import { Output, generateText } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildQuizQuestionPrompt } from "@/lib/ai/prompts";
import { getPersonalityOverride } from "@/lib/ai/prompt-overrides";
import { retrieveChunks } from "@/lib/ai/tools";
import { VoyageError } from "@/lib/ai/voyage";
import { MissingProviderKeyError, providerAuthErrorMessage, resolveChatModel } from "@/lib/ai/providers";
import { resolveVoyageKey } from "@/lib/ai/voyage";

export const maxDuration = 60;

const questionSchema = z.object({
  question: z.string(),
  topic: z.string(),
  modelAnswer: z.string(),
  sourceCitation: z.string(),
  fromPastExam: z.boolean(),
});

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

/** Pick a topic randomly, weighted toward the lowest average scores. */
function pickWeightedWeakTopic(rows: { topic: string; avg_score: number }[]): string | null {
  if (rows.length === 0) return null;
  const candidates = rows.slice(0, 5);
  // Weight = how much room for improvement, plus a floor so strong topics still appear occasionally.
  const weights = candidates.map((r) => 1 - Number(r.avg_score) + 0.15);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i].topic;
  }
  return candidates[candidates.length - 1].topic;
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

  let body: { courseId?: string; topic?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const { courseId, topic: explicitTopic } = body;
  if (!courseId) return jsonError("Expected { courseId, topic? }.", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("You must be signed in.", 401);

  const [{ data: course }, { data: weakTopicRows }, personalityOverride] = await Promise.all([
    supabase.from("courses").select("name").eq("id", courseId).single(),
    supabase.rpc("get_weak_topics", { match_course_id: courseId }),
    getPersonalityOverride(supabase, "quiz"),
  ]);
  if (!course) return jsonError("Course not found.", 404);

  const targetTopic =
    explicitTopic?.trim() ||
    pickWeightedWeakTopic((weakTopicRows ?? []) as { topic: string; avg_score: number }[]) ||
    `key concepts in ${course.name}`;

  try {
    const chunks = await retrieveChunks({
      voyageKey,
      supabase,
      courseId,
      query: targetTopic,
      count: 8,
    });
    if (chunks.length === 0) {
      return jsonError(
        "No course material found to build a question from — an admin needs to upload materials first.",
        404,
      );
    }

    const promptChunks = chunks.map((c) => ({
      content: c.content,
      citation: c.citation,
      isPastExam: c.category === "past_exam",
    }));
    const hasPastExamChunks = promptChunks.some((c) => c.isPastExam);

    const result = await generateText({
      model,
      output: Output.object({ schema: questionSchema }),
      prompt: buildQuizQuestionPrompt({
        courseName: course.name,
        topic: targetTopic,
        chunks: promptChunks,
        hasPastExamChunks,
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
