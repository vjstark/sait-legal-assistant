import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveModePrompt, resetModePrompt } from "@/app/actions/prompts";
import { DEFAULT_MODE_PERSONALITIES, type ModePersonalityKey } from "@/lib/ai/prompts";
import { PageHeader } from "@/components/ui";
import { PromptEditor, type PromptModeData } from "@/components/prompt-editor";

const MODE_INFO: Record<ModePersonalityKey, { name: string; description: string }> = {
  teach: {
    name: "Teach me",
    description: "The Socratic-style tutor personality used during a guided study session.",
  },
  lookup: {
    name: "Look it up",
    description: "The direct, no-frills reference-answer personality.",
  },
  quiz: {
    name: "Quiz me",
    description: "How the tutor writes exam-style practice questions.",
  },
  flashcards: {
    name: "Flashcards",
    description: "How the tutor writes flashcard fronts and backs.",
  },
};

const MODE_ORDER: ModePersonalityKey[] = ["teach", "lookup", "quiz", "flashcards"];

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error: errorMessage, saved } = await searchParams;
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

  const { data: overrideRows } = await supabase
    .from("mode_prompts")
    .select("mode, content")
    .in("mode", MODE_ORDER);

  const overrides = new Map(
    (overrideRows ?? []).map((row) => [row.mode as ModePersonalityKey, row.content as string]),
  );

  const modes: PromptModeData[] = MODE_ORDER.map((mode) => {
    const override = overrides.get(mode);
    return {
      key: mode,
      name: MODE_INFO[mode].name,
      description: MODE_INFO[mode].description,
      isCustomized: override != null,
      currentText: override ?? DEFAULT_MODE_PERSONALITIES[mode],
    };
  });

  return (
    <>
      <PageHeader
        title="Tutor prompts"
        description="The tutor's four teaching personalities. Edits apply immediately, sitewide. Safety rules — mandatory citations, course-material-only answers — are hardcoded and can't be overridden here."
      />

      <PromptEditor
        modes={modes}
        saveAction={saveModePrompt}
        resetAction={resetModePrompt}
        errorMessage={errorMessage}
        saved={Boolean(saved)}
      />
    </>
  );
}
