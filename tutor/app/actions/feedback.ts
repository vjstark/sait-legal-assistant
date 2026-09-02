"use server";

import { createClient } from "@/lib/supabase/server";

export async function recordMessageFeedback({
  courseId,
  mode,
  topic,
  rating,
}: {
  courseId: string;
  mode: "teach" | "lookup" | "quiz" | "flashcards";
  topic?: string | null;
  rating: "up" | "down";
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("message_feedback").insert({
    user_id: user.id,
    course_id: courseId,
    mode,
    topic: topic ?? null,
    rating,
  });
  if (error) return { error: error.message };
  return {};
}

export async function recordFlashcardReview({
  courseId,
  cardFront,
  cardBack,
  topic,
  selfRating,
}: {
  courseId: string;
  cardFront: string;
  cardBack: string;
  topic?: string | null;
  selfRating: "again" | "hard" | "good" | "easy";
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("flashcard_reviews").insert({
    user_id: user.id,
    course_id: courseId,
    card_front: cardFront,
    card_back: cardBack,
    topic: topic ?? null,
    self_rating: selfRating,
  });
  if (error) return { error: error.message };
  return {};
}
