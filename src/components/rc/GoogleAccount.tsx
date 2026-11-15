import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { authApi } from "@/lib/api";
import { GoogleSignIn } from "./GoogleSignIn";

export function GoogleAccount({ userId, email }: { userId: string; email: string | null }) {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLinked(null);
    setConnecting(false);
    setError("");
    authApi
      .googleLinkStatus()
      .then((result) => {
        if (active) setLinked(result.data.linked);
      })
      .catch((error) => {
        if (active)
          setError(error instanceof Error ? error.message : "Unable to check Google connection.");
      });
    return () => {
      active = false;
    };
  }, [userId, version]);
  const connect = useCallback(async (credential: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await authApi.linkGoogle(credential);
      setLinked(result.data.linked);
      setConnecting(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect Google.");
    } finally {
      setBusy(false);
    }
  }, []);
  return (
    <section className="mt-4 rounded-3xl border border-border bg-card p-5">
      <h2 className="text-base font-bold">Google sign-in</h2>
      {linked === true ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-success">
          <Check className="size-4" />
          Google account connected
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Connect Google to sign in to this account and keep your rides and wallet together.
            {email ? ` Choose ${email} on Google.` : " Add an email to your profile first."}
          </p>
          {linked === null && !error && (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              Checking connection…
            </p>
          )}
          {linked === false && !connecting && (
            <button
              type="button"
              disabled={!email}
              className="mt-4 min-h-11 w-full rounded-full border border-border px-4 text-sm font-bold disabled:opacity-50"
              onClick={() => setConnecting(true)}
            >
              Connect Google
            </button>
          )}
          {linked === false && connecting && (
            <div className="mt-4">
              <GoogleSignIn disabled={busy} onCredential={connect} />
            </div>
          )}
          {busy && (
            <p role="status" className="mt-2 text-xs">
              Connecting your Google account…
            </p>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="mt-3 text-xs text-destructive">
          <p>{error}</p>
          {linked === null && (
            <button
              type="button"
              onClick={() => setVersion((value) => value + 1)}
              className="mt-2 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </section>
  );
}
