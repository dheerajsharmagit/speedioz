import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { authApi, storage, type AuthResponse } from "@/lib/api";
import { GoogleSignIn } from "@/components/rc/GoogleSignIn";
import { CustomerPhoneAuth } from "@/components/rc/CustomerPhoneAuth";
import { LegalConsent } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode: "signin" | "signup" } => ({
    mode: search.mode === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — RIDEHER" },
      {
        name: "description",
        content:
          "Sign in or create your RideHer customer account with a mobile verification code, Google or email.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate(),
    router = useRouter();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const user = storage.getUser();
    if (user?.role === "CUSTOMER" && storage.getAccessToken()) void navigate({ to: "/ride" });
  }, [navigate]);
  const finishSignIn = async (response: AuthResponse) => {
    if (response.user.role !== "CUSTOMER")
      throw new Error("Please sign in with a customer account.");
    storage.saveAuth(response);
    await router.invalidate();
    await navigate({ to: "/ride" });
  };
  const handleGoogle = async (credential: string) => {
    setError(null);
    setLoading(true);
    try {
      await finishSignIn(await authApi.loginGoogle(credential));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };
  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await finishSignIn(
        await authApi.login({ email: email.trim(), password, expectedRole: "CUSTOMER" }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col border-x border-border px-5 py-8">
        <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
          RIDE<span className="text-primary">HER</span>
        </Link>
        <div className="mb-6 mt-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === "signup"
              ? "Join RideHer with your mobile number. We’ll verify it with an SMS code."
              : "Sign in to book your next RideHer journey."}
          </p>
        </div>
        <GoogleSignIn disabled={loading} onCredential={handleGoogle} />
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or continue with</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        {mode === "signin" && (
          <div className="mb-5 grid grid-cols-2 gap-2" role="group" aria-label="Sign-in method">
            {(
              [
                ["phone", "Mobile OTP"],
                ["email", "Email & password"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={loading}
                aria-pressed={method === key}
                onClick={() => {
                  setMethod(key);
                  setError(null);
                }}
                className={`min-h-11 rounded-xl border px-2 text-sm font-semibold disabled:opacity-50 ${method === key ? "border-primary bg-primary/5" : "border-border"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {method === "phone" || mode === "signup" ? (
          <CustomerPhoneAuth
            key={mode}
            mode={mode}
            disabled={loading}
            onSuccess={finishSignIn}
            onBusyChange={setLoading}
          />
        ) : (
          <form onSubmit={handleEmail} className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              <span>Email address</span>
              <input
                type="email"
                aria-label="Email address"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                className="h-14 w-full min-w-0 rounded-2xl border border-border bg-muted/50 px-4 text-base outline-none focus:border-primary"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Password</span>
              <input
                type="password"
                aria-label="Password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                className="h-14 w-full min-w-0 rounded-2xl border border-border bg-muted/50 px-4 text-base outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="min-h-14 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setError(null);
            setMode(mode === "signup" ? "signin" : "signup");
            setMethod("phone");
          }}
          className="my-5 min-h-11 text-center text-sm font-semibold text-muted-foreground disabled:opacity-50"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        <div className="mt-auto pt-5 text-center">
          <LegalConsent />
        </div>
      </main>
    </div>
  );
}
