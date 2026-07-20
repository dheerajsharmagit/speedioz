import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RideConnect AI" },
      { name: "description", content: "Sign in or create your RideConnect account with Google or email." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && !data.user.is_anonymous) {
        navigate({ to: "/ride" });
      }
    });
  }, [navigate]);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message ?? "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/ride" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/ride" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col border-x border-border bg-background px-6 py-10">
        <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
          RideConnect<span className="text-primary">.</span>
        </Link>

        <div className="mt-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
            {mode === "signup" ? "Ride smarter." : "Sign in."}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Save your trips, tips, and community routes."
              : "Continue where you left off."}
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-10 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card text-sm font-bold shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-14 w-full rounded-2xl bg-muted px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="h-14 w-full rounded-2xl bg-muted px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground"
          />
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="h-14 w-full rounded-2xl bg-secondary text-sm font-bold text-secondary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => { setError(null); setMode(mode === "signup" ? "signin" : "signup"); }}
          className="mt-6 text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>

        <p className="mt-auto pt-10 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          By continuing you agree to our terms.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 6.1 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.1 0 9.7-1.9 13.2-5.1l-6.1-5c-2 1.4-4.5 2.2-7.1 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.9l6.1 5C41.6 35.5 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
