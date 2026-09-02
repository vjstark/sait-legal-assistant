import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt, type LearningPreferences, type WeakTopic } from "@/lib/ai/prompts";
import { getPersonalityOverride } from "@/lib/ai/prompt-overrides";
import { buildTools } from "@/lib/ai/tools";
import { MissingProviderKeyError, providerAuthErrorMessage, resolveChatModel } from "@/lib/ai/providers";
import { resolveVoyageKey, VoyageError } from "@/lib/ai/voyage";
export const maxDuration = 60;

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

  let body: { messages?: UIMessage[]; mode?: string; courseId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const { messages, mode, courseId } = body;
  if (!Array.isArray(messages) || !courseId || (mode !== "teach" && mode !== "lookup")) {
    return jsonError("Expected { messages, mode: 'teach' | 'lookup', courseId }.", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("You must be signed in.", 401);

  const [{ data: course }, { data: profile }, { data: weakTopicRows }, personalityOverride] =
    await Promise.all([
      supabase.from("courses").select("name").eq("id", courseId).single(),
      supabase.from("profiles").select("learning_preferences").eq("id", user.id).single(),
      supabase.rpc("get_weak_topics", { match_course_id: courseId }),
      getPersonalityOverride(supabase, mode),
    ]);
  if (!course) return jsonError("Course not found.", 404);

  const system = buildSystemPrompt({
    mode,
    courseName: course.name,
    learningPreferences: (profile?.learning_preferences ?? null) as LearningPreferences | null,
    weakTopics: (weakTopicRows ?? []) as WeakTopic[],
    personalityOverride,
  });

  try {
    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(messages),
      tools: buildTools({ voyageKey, courseId, supabase }),
      stopWhen: isStepCount(5),
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        if (error instanceof VoyageError) return error.message;
        const authMessage = providerAuthErrorMessage(error, providerName);
        if (authMessage) return authMessage;
        return error instanceof Error ? error.message : "Something went wrong.";
      },
    });
  } catch (error) {
    if (error instanceof VoyageError) return jsonError(error.message, error.status);
    const authMessage = providerAuthErrorMessage(error, providerName);
    if (authMessage) return jsonError(authMessage, 401);
    return jsonError(error instanceof Error ? error.message : "Something went wrong.", 500);
  }
}
