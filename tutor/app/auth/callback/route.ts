import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Mark the invite as actually accepted now that the user clicked the
      // sign-in link and a session was created.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        const admin = createAdminClient();
        await admin
          .from("invites")
          .update({ status: "accepted" })
          .eq("email", user.email)
          .eq("status", "pending");
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
