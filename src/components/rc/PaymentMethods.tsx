import type { PaymentConfiguration } from "@/lib/api";
import { Banknote, Wallet } from "lucide-react";
import { isPaymentMethodAvailable, needsOnlinePayment, type ClientPayment } from "@/lib/payments";

export function PaymentMethods({
  payment,
  onChange,
  configuration,
  checking,
  failed,
  onRetry,
  walletBalance = null,
}: {
  payment: ClientPayment;
  onChange: (payment: ClientPayment) => void;
  configuration: PaymentConfiguration | null;
  checking: boolean;
  failed: boolean;
  onRetry: () => void;
  walletBalance?: number | null;
}) {
  const methods: { id: ClientPayment; label: string; sub: string }[] = [
    {
      id: "wallet",
      label: "RideHer wallet",
      sub:
        walletBalance === null
          ? "Check balance / add money"
          : `Balance ₹${walletBalance.toFixed(2)}`,
    },
    { id: "cash", label: "Pay at the end", sub: "Cash or scan captain’s QR" },
  ];
  const onlineAvailable = configuration?.configured && configuration.provider === "razorpay";
  return (
    <section className="space-y-3" aria-label="Payment options">
      <h3 className="text-sm font-semibold">How would you like to pay?</h3>
      {configuration?.mode === "test" && payment === "wallet" && (
        <p className="mb-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
          Test wallet: top-ups use test money, separate from your real balance.
        </p>
      )}
      {!configuration && checking && (
        <p role="status" className="mb-3 text-xs text-muted-foreground">
          Checking online payment options…
        </p>
      )}
      {payment === "wallet" && (failed || (configuration && !onlineAvailable)) && (
        <div className="mb-3 rounded-xl border border-border p-3 text-xs">
          <p role={failed ? "alert" : "status"}>
            {failed
              ? "Could not check wallet top-up availability. Please try again."
              : "Wallet top-ups are temporarily unavailable. Use your existing balance or pay at the end."}
          </p>
          <button
            type="button"
            disabled={checking}
            onClick={onRetry}
            className="mt-2 font-semibold text-primary underline disabled:opacity-60"
          >
            {checking ? "Checking payments…" : "Retry online payments"}
          </button>
        </div>
      )}
      <div role="radiogroup" aria-label="Payment method" className="space-y-2">
        {methods.map((method) => {
          const active = method.id === payment;
          const available =
            method.id === "wallet" || isPaymentMethodAvailable(method.id, configuration);
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!available}
              onClick={() => onChange(method.id)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                {method.id === "wallet" ? (
                  <Wallet aria-hidden className="size-5" />
                ) : (
                  <Banknote aria-hidden className="size-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{method.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {available
                    ? method.sub
                    : checking
                      ? "Checking availability…"
                      : "Currently unavailable"}
                </span>
              </span>
              <span
                aria-hidden
                className={`grid size-4 shrink-0 place-items-center rounded-full border ${active ? "border-primary" : "border-muted-foreground/40"}`}
              >
                {active && <span className="size-2 rounded-full bg-primary" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
