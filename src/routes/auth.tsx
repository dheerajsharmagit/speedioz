import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authApi, storage } from "@/lib/api";
import { GoogleSignIn } from "@/components/rc/GoogleSignIn";
import { LegalConsent } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode: "signin" | "signup" } => {
    return {
      mode: search.mode === "signup" ? "signup" : "signin",
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
  const router = useRouter();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = storage.getUser();
    if (user && storage.getAccessToken() && user.role === "CUSTOMER") {
      navigate({ to: "/ride" });
    }
  }, [navigate]);

  const handleGoogle = async (credential: string) => {
    setError(null);
    setLoading(true);
    try {
      const authRes = await authApi.loginGoogle(credential);
      if (authRes.user.role !== "CUSTOMER")
        throw new Error("Please sign in with a customer account.");
      storage.saveAuth(authRes);
      await router.invalidate();
      navigate({ to: "/ride" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let authRes;
      if (mode === "signup") {
        authRes = await authApi.signup({
          email,
          password,
          name: name || email.split("@")[0],
          phone: mobile,
          gender: "FEMALE",
          role: "CUSTOMER",
        });
      } else {
        authRes = await authApi.login({ email: email.trim(), password, expectedRole: "CUSTOMER" });
      }

      if (authRes.user.role !== "CUSTOMER")
        throw new Error("Please sign in with a customer account.");
      storage.saveAuth(authRes);
      await router.invalidate();
      navigate({ to: "/ride" });
    } catch (e) {
      console.error("Auth error:", e);
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

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
            Sign in to your customer account to book a ride.
          </p>
        </div>

        <div className="mt-6">
          <GoogleSignIn disabled={loading} onCredential={handleGoogle} />
        </div>
        {loading && (
          <p role="status" className="mt-2 text-center text-xs text-muted-foreground">
            Signing in…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
          >
            {error}
          </p>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <>
              <input
                type="text"
                aria-label="Full name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="h-14 w-full rounded-2xl bg-muted px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />
              <input
                type="tel"
                aria-label="Mobile number"
                autoComplete="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Mobile Number"
                className="h-14 w-full rounded-2xl bg-muted px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />
            </>
          )}

          <>
            <input
              type="email"
              aria-label="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-14 w-full rounded-2xl bg-muted px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground"
            />
            <input
              type="password"
              aria-label="Password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className="h-14 w-full rounded-2xl bg-muted px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground"
            />
          </>

          <button
            type="submit"
            disabled={loading}
            className="h-14 w-full rounded-2xl bg-secondary text-sm font-bold text-secondary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "signup" ? "signin" : "signup");
          }}
          className="mt-6 text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>

        <div className="mt-auto pt-8 text-center"><LegalConsent /></div>
      </div>
    </div>
  );
}
