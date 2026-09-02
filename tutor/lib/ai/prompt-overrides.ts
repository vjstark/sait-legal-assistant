import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModePersonalityKey } from "@/lib/ai/prompts";

// ─────────────────────────────────────────────────────────────────
// Reads an admin-saved personality override for one tutor mode from
// mode_prompts. A missing row means "use the built-in default" — see
// DEFAULT_MODE_PERSONALITIES in lib/ai/prompts.ts.
//
// `supabase` must be the user-scoped server client so RLS applies —
// every signed-in user can read (see supabase/migrations/0005), which
// is all this needs.
// ─────────────────────────────────────────────────────────────────

export async function getPersonalityOverride(
  supabase: SupabaseClient,
  mode: ModePersonalityKey,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mode_prompts")
    .select("content")
    .eq("mode", mode)
    .maybeSingle();
  if (error || !data) return null;
  return data.content;
}
