"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function redirectWithError(message: string): never {
  redirect("/admin/invites?error=" + encodeURIComponent(message));
}

export async function inviteClassmate(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const rawRole = String(formData.get("role") ?? "student");
  const requestedRole =
    rawRole === "admin" || rawRole === "contributor" ? rawRole : "student";

  if (!email) {
    redirectWithError("Email is required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirectWithError("Only admins can invite people.");
  }

  // The invites row must exist before the auth user is created — the
  // handle_new_user trigger reads it to decide the new profile's role.
  const { error: insertError } = await supabase.from("invites").insert({
    email,
    role: requestedRole,
    invited_by: user.id,
  });
  if (insertError) {
    redirectWithError(insertError.message);
  }

  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  );
  if (inviteError) {
    redirectWithError(inviteError.message);
  }

  revalidatePath("/admin/invites");
  redirect("/admin/invites?success=1");
}
