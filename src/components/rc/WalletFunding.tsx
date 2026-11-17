import { useRef, useState } from "react";
import { LegalConsent } from "@/components/legal/LegalPage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentApi, storage, walletApi, type WalletTopUp } from "@/lib/api";
import { razorpayCheckoutDetails } from "@/lib/payments";
import { openRazorpayCheckout, RAZORPAY_CHECKOUT_DISMISSED } from "@/lib/razorpay";

export const walletQueryKey = () => ["customer-wallet", storage.getUser()?.id];
export function WalletFunding({ requiredFare = 0 }: { requiredFare?: number }) {
  const client = useQueryClient();
  const wallet = useQuery({
    queryKey: walletQueryKey(),
    queryFn: walletApi.details,
    refetchInterval: 15000,
  });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const key = useRef<{ amount: number; key: string } | null>(null);
  const busyRef = useRef(false);
  const shortfall = Math.max(
    0,
    Math.ceil((requiredFare - (wallet.data?.balance ?? 0)) * 100) / 100,
  );
  const requestedAmount = amount === "" ? Math.max(shortfall, 100) : Number(amount);
  const refresh = () => client.invalidateQueries({ queryKey: walletQueryKey() });
  async function topUp(existing?: WalletTopUp, statusOnly = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (
        !existing &&
        (!Number.isFinite(requestedAmount) ||
          requestedAmount < 1 ||
          requestedAmount > 10000 ||
          Math.round(requestedAmount * 100) / 100 !== requestedAmount)
      )
        throw new Error("Enter an amount from ₹1 to ₹10,000 with at most two decimals.");
      const config = await paymentApi.configuration();
      if (!config.configured || config.provider !== "razorpay")
        throw new Error("Online top-ups are temporarily unavailable. You can book with cash.");
      if (!existing && !key.current)
        key.current = { amount: requestedAmount, key: crypto.randomUUID() };
      if (!existing && key.current!.amount !== requestedAmount)
        throw new Error("Check the previous top-up before changing its amount.");
      const topup = existing ?? (await walletApi.createTopUp(requestedAmount, key.current!.key));
      // Persisted pending orders are reloaded after dismissal, network loss or refresh.
      await refresh();
      let verified: WalletTopUp = await walletApi.confirmTopUp(topup.id);
      if (verified.status === "PAID" || verified.status === "REFUNDED" || statusOnly) {
        /* Use the server's existing capture without opening another checkout. */
      } else {
        const checkout = razorpayCheckoutDetails(topup);
        const user = storage.getUser();
        const callback = await openRazorpayCheckout({
          ...checkout,
          name: "RideHer",
          description: topup.mode === "test" ? "Test wallet top-up" : "Wallet top-up",
          prefill: {
            name: user?.name,
            contact: user?.phone ?? undefined,
            email: user?.email ?? undefined,
          },
        });
        if (callback.razorpay_order_id !== checkout.orderId)
          throw new Error("Unexpected payment order. Check its status before retrying.");
        verified = await walletApi.confirmTopUp(topup.id, {
          paymentId: callback.razorpay_payment_id,
          signature: callback.razorpay_signature,
        });
      }
      if (verified.status === "PAID") {
        key.current = null;
        setAmount("");
        setMessage("Money added to your wallet. You can continue booking.");
      } else if (verified.status === "REFUNDED") {
        key.current = null;
        setMessage(
          "This top-up was refunded. Its wallet reversal is shown in transaction history.",
        );
      } else setMessage("Payment is being verified. Check its status before paying again.");
      await refresh();
    } catch (error) {
      if (!(error instanceof Error && error.message === RAZORPAY_CHECKOUT_DISMISSED))
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to process the top-up. Please check its status.",
        );
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      aria-label="RideHer wallet"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold">RideHer wallet</h3>
        <p className="text-xl font-extrabold">
          {wallet.data ? `₹${wallet.data.balance.toFixed(2)}` : "—"}
        </p>
      </div>
      {wallet.isPending && (
        <p role="status" className="text-xs">
          Loading wallet…
        </p>
      )}
      {wallet.isError && (
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => wallet.refetch()}
        >
          Retry wallet balance
        </button>
      )}
      {wallet.data?.mode === "test" && (
        <p className="rounded-xl bg-amber-400/15 p-3 text-xs">
          Test wallet: these funds are separate from real money and cannot be withdrawn.
        </p>
      )}
      {shortfall > 0 && (
        <p className="text-sm">
          Add at least ₹{shortfall.toFixed(2)} for this ride, or choose cash at the end.
        </p>
      )}
      {wallet.data?.pendingTopUps?.map((topup) => (
        <div key={topup.id} className="space-y-2 rounded-xl bg-muted p-3 text-xs">
          <p>Pending top-up · ₹{(topup.amountPaise / 100).toFixed(2)}</p>
          {topup.providerIntentId?.startsWith("creating:") ? (
            <p>
              Order creation needs support recovery. Contact support with reference {topup.id}{" "}
              before paying again.
            </p>
          ) : (
            <div className="flex gap-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => topUp(topup)}
                className="font-bold text-primary underline"
              >
                Continue payment
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => topUp(topup, true)}
                className="font-bold underline"
              >
                Check status
              </button>
            </div>
          )}
        </div>
      ))}
      {!wallet.isPending && !wallet.isError && !wallet.data?.pendingTopUps?.length && (
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1 text-xs">
            Amount to add (₹)
            <input
              aria-label="Amount to add"
              type="number"
              inputMode="decimal"
              min="1"
              max="10000"
              step="0.01"
              value={amount}
              placeholder={String(Math.max(shortfall, 100))}
              onChange={(event) => setAmount(event.target.value)}
              disabled={busy}
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => topUp()}
            className="mt-5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? "Checking payment…"
              : Number.isFinite(requestedAmount)
                ? `Add ₹${requestedAmount.toFixed(2)}`
                : "Add money"}
          </button>
        </div>
      )}
      <LegalConsent action="adding money" />
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
