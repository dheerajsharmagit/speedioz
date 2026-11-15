import { useEffect, useRef, useState } from "react";
import { authApi } from "@/lib/api";
import { loadGoogleIdentity } from "@/lib/google-identity";

export function GoogleSignIn({
  disabled = false,
  onCredential,
}: {
  disabled?: boolean;
  onCredential: (credential: string) => Promise<void>;
}) {
  const target = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const disabledRef = useRef(disabled);
  const processing = useRef(false);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    callback.current = onCredential;
    disabledRef.current = disabled;
  }, [onCredential, disabled]);
  useEffect(() => {
    let active = true;
    const container = target.current;
    setState("loading");
    setError("");
    async function render() {
      try {
        const { data: config } = await authApi.googleConfiguration();
        if (!active) return;
        if (!config.enabled || !config.clientId)
          throw new Error("Google sign-in is not available yet. You can sign in with email.");
        const client = await loadGoogleIdentity();
        if (!active || !container) return;
        client.initialize({
          client_id: config.clientId,
          auto_select: false,
          ux_mode: "popup",
          callback: (response) => {
            if (!active || disabledRef.current || processing.current) return;
            if (!response.credential) {
              setError("Google did not return a sign-in credential. Please try again.");
              return;
            }
            processing.current = true;
            void callback
              .current(response.credential)
              .catch((error) => {
                if (active)
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Google sign-in failed. Please try again.",
                  );
              })
              .finally(() => {
                processing.current = false;
              });
          },
        });
        container.replaceChildren();
        client.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: String(Math.min(400, Math.max(200, Math.floor(container.clientWidth)))),
          logo_alignment: "left",
        });
        setState("ready");
      } catch (error) {
        if (active) {
          setState("error");
          setError(error instanceof Error ? error.message : "Google sign-in is unavailable.");
        }
      }
    }
    void render();
    return () => {
      active = false;
      container?.replaceChildren();
    };
  }, [version]);
  return (
    <div className="w-full" aria-label="Google sign-in">
      <div
        ref={target}
        inert={disabled}
        aria-disabled={disabled}
        className={`min-h-11 w-full overflow-hidden ${disabled ? "pointer-events-none opacity-50" : ""}`}
      />
      {state === "loading" && (
        <p
          role="status"
          className="-mt-9 flex min-h-9 items-center justify-center text-sm text-muted-foreground"
        >
          Loading Google sign-in…
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-xl bg-muted p-3 text-xs" role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVersion((value) => value + 1)}
            className="mt-2 font-bold underline"
          >
            Retry Google sign-in
          </button>
        </div>
      )}
    </div>
  );
}
