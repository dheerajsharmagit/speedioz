import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { authApi, storage, type AuthUser } from "@/lib/api";

export function RequireRole({ role, children }: { role: AuthUser["role"]; children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setStatus("loading");
    if (!storage.getAccessToken()) {
      setStatus("denied");
      return;
    }
    authApi
      .me()
      .then(({ user }) => {
        if (disposed) return;
        storage.saveUser(user);
        setStatus(user.role === role && !user.isSuspended ? "allowed" : "denied");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
    };
  }, [role, attempt]);
  if (status === "allowed") return children;
  return (
    <main className="mx-auto max-w-lg p-8 text-center">
      <p role="status">
        {status === "loading"
          ? "Checking access…"
          : status === "error"
            ? "Could not verify your account."
            : `An active ${role.toLowerCase()} account is required.`}
      </p>
      {status === "error" && (
        <button className="m-4 underline" onClick={() => setAttempt(attempt + 1)}>
          Try again
        </button>
      )}
      {status === "denied" && (
        <Link className="m-4 inline-block underline" to="/auth" search={{ mode: "signin", role }}>
          Sign in with another account
        </Link>
      )}
      <Link className="m-4 inline-block underline" to="/">
        Home
      </Link>
    </main>
  );
}
