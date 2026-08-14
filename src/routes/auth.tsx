import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authApi, storage } from "@/lib/api";
import { lovable } from "@/integrations/lovable";

type Role = "CUSTOMER";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signin" | "signup" } => {
    return {
      mode: (search.mode === "signin" || search.mode === "signup" ? search.mode : undefined) as "signin" | "signup" | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in — RIDEHER" },
      { name: "description", content: "Sign in to RIDEHER with Google or email." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode === "signin" ? "signin" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = storage.getUser();
    if (user) {
      navigate({ to: "/ride" });
    }
  }, [navigate]);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      
      // Lovable auth will redirect. After redirect back to /auth, 
      // we need to handle the credential if it's in the URL or session.
      // However, the standard flow in the provided docs is to send the Google ID token.
      // For web, if we use Supabase OAuth, the user is already signed into Supabase.
      // We might need to get the session and then call our backend.
      
      if (result.error) throw result.error;
      
      // If we are already signed in to Supabase, we get the token and sign up to our backend
      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      if (session?.access_token) {
        const authRes = await authApi.signupGoogle(session.access_token);
        storage.saveAuth(authRes);
        navigate({ to: "/ride" });
      }
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
      setLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let authRes;
      if (mode === "signup") {
        authRes = await authApi.signup({
          email,
          password,
          name: email.split("@")[0],
          gender: "FEMALE",
          role: "CUSTOMER"
        });
      } else {
        authRes = await authApi.login({ email, password });
      }
      storage.saveAuth(authRes);
      navigate({ to: mode === "signup" ? "/onboarding" : "/ride" });
    } catch (e: any) {
      setError(e.error?.message || e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col border-x border-border bg-background px-6 py-10">
        <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
          RIDE<span className="text-primary">HER</span>
        </Link>

        <div className="mt-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
            {mode === "signup" ? "Travel safely." : "Welcome back."}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to your customer account to book a safe ride.
          </p>
        </div>


        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card text-sm font-bold shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
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
            {loading ? "…" : mode === "signup"
              ? "Create rider account"
              : "Sign in as customer"}
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
