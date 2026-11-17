import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi, RequestError, type AuthResponse } from "@/lib/api";

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  const phone = /^\d{10}$/.test(compact) ? `+91${compact}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new Error("Enter a 10-digit Indian mobile number, or include your country code with +.");
  return phone;
}
const fieldClass =
  "h-14 w-full min-w-0 rounded-2xl border border-border bg-muted/50 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const buttonClass =
  "min-h-14 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50";

export function CustomerPhoneAuth({
  mode,
  disabled,
  onSuccess,
  onBusyChange,
}: {
  mode: "signin" | "signup";
  disabled: boolean;
  onSuccess: (response: AuthResponse) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const config = useQuery({
    queryKey: ["customer-otp-config"],
    queryFn: authApi.otpConfiguration,
    staleTime: 60000,
    retry: 1,
  });
  const [phone, setPhone] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<{ phone: string; expiresAt: number } | null>(null);
  const [code, setCode] = useState(""),
    [resendAt, setResendAt] = useState(0),
    [now, setNow] = useState(Date.now);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const version = useRef(0),
    busyRef = useRef(false);
  useEffect(() => {
    version.current++;
    setChallenge(null);
    setCode("");
    setError("");
    setResendAt(0);
    return () => {
      version.current++;
    };
  }, [mode]);
  useEffect(() => {
    if (!challenge && !resendAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 500);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [challenge, resendAt]);
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = Boolean(challenge && challenge.expiresAt <= now);
  const reportError = (failure: unknown) => {
    setError(
      failure instanceof Error
        ? failure.message
        : "Unable to complete verification. Please try again.",
    );
    if (
      failure instanceof RequestError &&
      failure.error.details &&
      typeof failure.error.details === "object"
    ) {
      const seconds = Number(
        (failure.error.details as { retryAfterSeconds?: unknown }).retryAfterSeconds,
      );
      if (Number.isFinite(seconds) && seconds > 0) setResendAt(Date.now() + seconds * 1000);
    }
  };
  const setWorking = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
    onBusyChange(value);
  };
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busyRef.current || disabled || cooldown > 0 || !config.data?.configured) return;
    setError("");
    const operation = version.current;
    try {
      const normalized = challenge?.phone ?? normalizePhone(phone);
      setWorking(true);
      const sent = await authApi.sendOtp(normalized, mode === "signup" ? "SIGNUP" : "LOGIN");
      if (operation !== version.current) return;
      if (!sent.sent || !Number.isFinite(sent.expiresInSeconds) || sent.expiresInSeconds <= 0)
        throw new Error("The code could not be sent. Please try again.");
      const at = Date.now();
      setCode("");
      setNow(at);
      setChallenge({ phone: normalized, expiresAt: at + sent.expiresInSeconds * 1000 });
      setResendAt(at + Math.max(60, sent.resendAfterSeconds || 60) * 1000);
    } catch (failure) {
      if (operation === version.current) reportError(failure);
    } finally {
      if (operation === version.current) setWorking(false);
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge || busyRef.current || disabled || expired || !/^\d{6}$/.test(code)) return;
    const operation = version.current;
    setError("");
    setWorking(true);
    try {
      const response =
        mode === "signup"
          ? await authApi.signup({
              name: name.trim(),
              email: email.trim(),
              phone: challenge.phone,
              otp: code,
            })
          : await authApi.verifyOtp(challenge.phone, code);
      if (operation !== version.current) return;
      if (response.user.role !== "CUSTOMER")
        throw new Error("Please sign in with a customer account.");
      await onSuccess(response);
    } catch (failure) {
      if (operation === version.current) reportError(failure);
    } finally {
      if (operation === version.current) setWorking(false);
    }
  };
  return (
    <section aria-label="Mobile OTP sign-in" className="space-y-4">
      {(config.isPending || config.isError || !config.data?.configured) && (
        <div
          className="rounded-2xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
          role={config.isError ? "alert" : "status"}
        >
          {config.isPending
            ? "Checking SMS availability…"
            : config.isError
              ? "Unable to check SMS sign-in. Please retry."
              : "SMS sign-in is not available yet. You can use Google or email sign-in."}
          {config.isError && (
            <button
              type="button"
              className="ml-2 min-h-8 font-semibold text-primary underline"
              onClick={() => void config.refetch()}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {!challenge ? (
        <form onSubmit={send} className="space-y-4">
          {mode === "signup" && (
            <>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Full name</span>
                <input
                  aria-label="Full name"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy || disabled}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Email address</span>
                <input
                  aria-label="Email address"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy || disabled}
                  className={fieldClass}
                />
              </label>
            </>
          )}
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Mobile number</span>
            <input
              aria-label="Mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={busy || disabled}
              className={fieldClass}
            />
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            We’ll send a six-digit verification code by SMS.
          </p>
          <button
            type="submit"
            className={buttonClass}
            disabled={busy || disabled || cooldown > 0 || !config.data?.configured}
          >
            {busy
              ? "Sending code…"
              : cooldown > 0
                ? `Try again in ${cooldown}s`
                : "Send verification code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              Code sent to <strong>{challenge.phone}</strong>
            </p>
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => {
                version.current++;
                setChallenge(null);
                setCode("");
                setError("");
                setResendAt(0);
              }}
              className="min-h-9 text-xs font-semibold text-primary"
            >
              Change number
            </button>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            <span>Verification code</span>
            <input
              aria-label="Verification code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={busy || disabled || expired}
              aria-invalid={!!error}
              className={`${fieldClass} text-center font-mono text-2xl font-bold tracking-[0.3em]`}
            />
          </label>
          {expired ? (
            <p role="status" className="text-sm text-destructive">
              This code has expired. Request a new code to continue.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enter the code from your SMS. Don’t share it with anyone.
            </p>
          )}
          <button
            type="submit"
            className={buttonClass}
            disabled={busy || disabled || expired || code.length !== 6}
          >
            {busy
              ? "Verifying…"
              : mode === "signup"
                ? "Verify & create account"
                : "Verify & sign in"}
          </button>
          <button
            type="button"
            disabled={busy || disabled || cooldown > 0}
            onClick={() => void send()}
            className="min-h-11 w-full text-sm font-semibold text-primary disabled:text-muted-foreground"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend verification code"}
          </button>
        </form>
      )}
    </section>
  );
}
