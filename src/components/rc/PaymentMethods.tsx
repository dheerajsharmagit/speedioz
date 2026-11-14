import type { PaymentConfiguration } from "@/lib/api";
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
    <div className="mb-6 px-6">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Payment
      </p>
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
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2">
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
              className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-foreground bg-secondary text-secondary-foreground"
                  : "border-border bg-background"
              }`}
            >
              <p className="text-sm font-bold">{method.label}</p>
              <p
                className={`mt-1 text-[10px] ${active ? "text-secondary-foreground/60" : "text-muted-foreground"}`}
              >
                {available
                  ? method.sub
                  : checking
                    ? "Checking availability…"
                    : "Currently unavailable"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
