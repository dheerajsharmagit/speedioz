import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { collectionApi, storage } from "@/lib/api";

export function CustomerCollection({ rideId }: { rideId: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["ride-collection", storage.getUser()?.id, rideId],
    queryFn: () => collectionApi.reconcile(rideId),
    refetchInterval: (query) => (query.state.data?.paymentStatus === "PAID" ? false : 5000),
  });
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      await collectionApi.create(rideId);
      await query.refetch();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to prepare payment");
    } finally {
      setBusy(false);
    }
  }
  const data = query.data;
  return (
    <section
      className="mx-6 mb-5 space-y-3 rounded-2xl border border-border p-4"
      aria-label="Ride payment"
    >
      <h3 className="font-bold">
        {data?.paymentStatus === "PAID" ? "Payment received" : "Pay for your ride"}
      </h3>
      {query.isPending && (
        <p role="status" className="text-sm">
          Checking payment status…
        </p>
      )}
      {query.isError && (
        <button onClick={() => query.refetch()} className="text-sm underline">
          Retry payment status
        </button>
      )}
      {data && (
        <>
          <p className="text-2xl font-extrabold">₹{(data.amountPaise / 100).toFixed(2)}</p>
          {data.paymentStatus === "PAID" ? (
            <p className="text-sm">
              {data.paymentMethod === "CASH"
                ? "Your captain confirmed the cash collection."
                : "Your payment has been verified."}
            </p>
          ) : data.paymentStatus === "REFUNDED" ? (
            <p className="text-sm">Payment refunded. Contact support if you need help.</p>
          ) : (
            <>
              <p className="text-sm">
                Pay cash to your captain, or pay online through RideHer. Your captain confirms cash
                collection.
              </p>
              {data.mode === "test" && (
                <p className="rounded-xl bg-amber-400/15 p-3 text-xs">
                  Razorpay test payment: no real money is collected.
                </p>
              )}
              {data.checkoutUrl ? (
                <a
                  href={data.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-full bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground"
                >
                  Open Razorpay checkout
                </a>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={prepare}
                  className="w-full rounded-full border px-4 py-3 text-sm font-bold"
                >
                  {busy ? "Preparing payment…" : "Pay online instead"}
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                After paying, return here. This screen updates when payment is verified.
              </p>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
