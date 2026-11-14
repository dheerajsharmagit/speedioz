import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { storage, walletApi } from "@/lib/api";
import { WalletFunding, walletQueryKey } from "@/components/rc/WalletFunding";
import { RoleNav } from "@/components/rc/RoleNav";
export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Your wallet — RideHer" }] }),
  component: WalletPage,
});
function WalletPage() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(Boolean(storage.getAccessToken())), []);
  const query = useQuery({
    queryKey: walletQueryKey(),
    queryFn: walletApi.details,
    enabled: signedIn,
  });
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[480px] flex-1 space-y-5 px-5 py-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Your wallet</h1>
          <Link to="/ride" className="text-sm font-bold text-primary">
            Book a ride
          </Link>
        </div>
        {!signedIn ? (
          <Link to="/auth" search={{ mode: "signin" }}>
            Sign in to manage your wallet
          </Link>
        ) : (
          <>
            <WalletFunding />
            <h2 className="font-bold">Transaction history</h2>
            {query.data?.transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Your verified top-ups, ride payments and refunds will appear here.
              </p>
            )}
            {query.data?.transactions.map((transaction) => (
              <div key={transaction.id} className="rounded-2xl border bg-card p-4">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-bold">
                    {transaction.source === "RAZORPAY"
                      ? "Wallet top-up"
                      : transaction.source === "RIDE"
                        ? "Ride payment"
                        : transaction.source === "REFUND"
                          ? "Refund / reversal"
                          : "Wallet adjustment"}
                  </p>
                  <p
                    className={
                      transaction.type === "CREDIT" ? "font-bold text-emerald-600" : "font-bold"
                    }
                  >
                    {transaction.type === "CREDIT" ? "+" : "−"}₹
                    {(transaction.amountPaise / 100).toFixed(2)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(transaction.createdAt).toLocaleString("en-IN")} · Balance ₹
                  {(transaction.balanceAfterPaise / 100).toFixed(2)}
                </p>
              </div>
            ))}
          </>
        )}
      </main>
      <RoleNav />
    </div>
  );
}
