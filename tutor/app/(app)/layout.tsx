import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import NavLinks from "@/components/nav-links";

function Brand() {
  return (
    <Link
      href="/courses"
      className="flex shrink-0 items-baseline gap-1.5 font-serif text-lg font-semibold text-brand-900"
    >
      <span aria-hidden className="text-accent-700">
        §
      </span>
      Law Study Tutor
    </Link>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, learning_preferences")
    .eq("id", user.id)
    .single();

  if (!profile?.learning_preferences) {
    redirect("/onboarding");
  }

  const links = [
    { href: "/courses", label: "Courses" },
    ...(profile?.role === "admin"
      ? [
          { href: "/admin/invites", label: "Invites" },
          { href: "/admin/prompts", label: "Tutor prompts" },
          { href: "/admin/usage", label: "Usage" },
        ]
      : []),
    { href: "/settings/api-keys", label: "API keys" },
    { href: "/settings/learning-preferences", label: "Preferences" },
  ];

  const displayName = profile?.display_name ?? user.email;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Desktop: fixed-width sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-surface px-4 py-5 lg:flex">
        <Brand />
        <nav className="flex-1">
          <NavLinks links={links} orientation="col" />
        </nav>
        <div className="border-t border-line pt-4">
          <p className="mb-2 truncate px-3 text-sm text-slate-500" title={displayName ?? undefined}>
            {displayName}
          </p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Mobile: compact top bar */}
        <nav className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-4 px-4">
            <Brand />
            <div className="min-w-0 flex-1">
              <NavLinks links={links} />
            </div>
            <SignOutButton />
          </div>
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
