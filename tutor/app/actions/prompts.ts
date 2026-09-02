"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MODE_PERSONALITIES, type ModePersonalityKey } from "@/lib/ai/prompts";

const VALID_MODES: ModePersonalityKey[] = ["teach", "lookup", "quiz", "flashcards"];

function redirectWithError(message: string): never {
  redirect("/admin/prompts?error=" + encodeURIComponent(message));
}

function parseMode(value: FormDataEntryValue | null): ModePersonalityKey {
  if (typeof value === "string" && (VALID_MODES as string[]).includes(value)) {
    return value as ModePersonalityKey;
  }
  redirectWithError("Unknown mode.");
}

/** Verifies the caller is signed in and an admin; redirects otherwise. */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/courses");

  return { supabase, user };
}

export async function saveModePrompt(formData: FormData) {
  const mode = parseMode(formData.get("mode"));
  const content = String(formData.get("content") ?? "").trim();
  if (!content) {
    redirectWithError("Prompt text can't be empty.");
  }

  const { supabase } = await requireAdmin();

  // If the saved text is identical to the built-in default, there's
  // nothing to override — delete any existing row instead of storing
  // a redundant duplicate that would just mask future default edits.
  if (content === DEFAULT_MODE_PERSONALITIES[mode].trim()) {
    const { error } = await supabase.from("mode_prompts").delete().eq("mode", mode);
    if (error) redirectWithError(error.message);
  } else {
    const { error } = await supabase
      .from("mode_prompts")
      .upsert({ mode, content, updated_at: new Date().toISOString() });
    if (error) redirectWithError(error.message);
  }

  revalidatePath("/admin/prompts");
  redirect("/admin/prompts?saved=1");
}

export async function resetModePrompt(formData: FormData) {
  const mode = parseMode(formData.get("mode"));
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("mode_prompts").delete().eq("mode", mode);
  if (error) redirectWithError(error.message);

  revalidatePath("/admin/prompts");
  redirect("/admin/prompts?saved=1");
}
