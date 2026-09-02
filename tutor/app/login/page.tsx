"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, CardBody, Input, Label, Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error" | "signing-in"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Invite and admin-generated links arrive with the session in the URL
  // fragment (#access_token=…) rather than a ?code= the server callback can
  // exchange — the fragment survives the redirect to this page, so finish
  // the sign-in here.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    // One-time sync with the URL fragment on mount — the recommended
    // "subscribe to external system" shape doesn't fit a read-once hash.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("signing-in");
    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setStatus("error");
          setErrorMessage(`Sign-in link problem: ${error.message}`);
          return;
        }
        window.location.hash = "";
        router.replace("/");
        router.refresh();
      });
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Invite-only: never create an account from the public login page.
        // New members join via an admin invite, which creates their account.
        shouldCreateUser: false,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(
        /signups not allowed|user not found/i.test(error.message)
          ? "No account found for that email — ask the group admin for an invite."
          : error.message,
      );
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <p className="text-center font-serif text-2xl font-semibold tracking-tight text-brand-900">
          <span aria-hidden className="text-accent-700">
            §
          </span>{" "}
          Law Study Tutor
        </p>

        <Card>
          <CardBody className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Sign in</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Enter the email your invite was sent to — we&apos;ll email you a
                magic link, no password needed.
              </p>
            </div>

            {status === "signing-in" ? (
              <Alert tone="info">
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Signing you in…
                </span>
              </Alert>
            ) : status === "sent" ? (
              <Alert tone="info">
                <span className="font-medium">Check your inbox</span> — we sent a
                sign-in link to {email}.
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {status === "error" && <Alert tone="error">{errorMessage}</Alert>}
                <div>
                  <Label htmlFor="login-email">Email address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full"
                >
                  {status === "sending" && (
                    <Spinner className="border-white/40 border-t-white" />
                  )}
                  {status === "sending" ? "Sending…" : "Send magic link"}
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
