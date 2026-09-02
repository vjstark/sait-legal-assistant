"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveLearningPreferences(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const learningPreferences = {
    explanationStyle: String(formData.get("explanationStyle") ?? "detailed"),
    quizFrequency: String(formData.get("quizFrequency") ?? "after_reading"),
    priorBackground: String(formData.get("priorBackground") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ learning_preferences: learningPreferences })
    .eq("id", user.id);

  if (error) {
    const referer = String(formData.get("_referer") ?? "/onboarding");
    redirect(`${referer}?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/courses");
}
