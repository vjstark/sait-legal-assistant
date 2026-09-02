import { Output, generateText } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildQuizGradingPrompt } from "@/lib/ai/prompts";
import { MissingProviderKeyError, providerAuthErrorMessage, resolveChatModel } from "@/lib/ai/providers";

export const maxDuration = 60;

const gradeSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  explanation: z.string(),
});

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  let chatModel: ReturnType<typeof resolveChatModel>;
  try {
    chatModel = resolveChatModel(request.headers);
  } catch (error) {
    if (error instanceof MissingProviderKeyError) return jsonError(error.message, error.status);
    throw error;
  }
  const { model, providerName } = chatModel;

  let body: {
    courseId?: string;
    question?: string;
    topic?: string;
    modelAnswer?: string;
    studentAnswer?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const { courseId, question, topic, modelAnswer, studentAnswer } = body;
  if (!courseId || !question || !modelAnswer || !studentAnswer) {
    return jsonError(
      "Expected { courseId, question, topic, modelAnswer, studentAnswer }.",
      400,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("You must be signed in.", 401);

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: gradeSchema }),
      prompt: buildQuizGradingPrompt({ question, modelAnswer, studentAnswer }),
    });
    const grade = result.output;

    const { error: insertError } = await supabase.from("quiz_attempts").insert({
      user_id: user.id,
      course_id: courseId,
      question,
      student_answer: studentAnswer,
      score: grade.score,
      ai_feedback: grade.explanation,
      topic: topic || null,
    });
    if (insertError) {
      return jsonError(`Grading succeeded but saving the attempt failed: ${insertError.message}`, 500);
    }

    return Response.json(grade);
  } catch (error) {
    const authMessage = providerAuthErrorMessage(error, providerName);
    if (authMessage) return jsonError(authMessage, 401);
    return jsonError(error instanceof Error ? error.message : "Something went wrong.", 500);
  }
}
