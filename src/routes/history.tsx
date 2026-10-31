import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { RoleNav } from "@/components/rc/RoleNav";
import { RequestError, rideApi, storage, type RideHistoryItem } from "@/lib/api";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your trips — RIDEHER" },
      { name: "description", content: "See your past RIDEHER rides, fares and payment status." },
      { property: "og:title", content: "Your trips — RIDEHER" },
      { property: "og:description", content: "See your past RIDEHER rides, fares and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const statusLabel: Record<string, string> = {
  SEARCHING: "Searching", MATCHED: "Matched", ARRIVING: "Arriving", IN_PROGRESS: "In progress",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};

function HistoryPage() {
  const [items, setItems] = useState<RideHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setError(null);
    if (!storage.getAccessToken()) { setSignedOut(true); return; }
    try {
      setItems(await rideApi.history());
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) setSignedOut(true);
      else setError(e instanceof Error ? e.message : "Couldn't load your trips.");
    }
  }
  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Your trips</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fares and payment status for every ride.</p>

        <div className="mt-6 space-y-3">
          {signedOut ? (
            <div className="rounded-3xl border border-border bg-card p-6 text-center">
              <p className="font-semibold">Sign in to see your trips</p>
              <Link to="/auth" search={{ mode: "signin" } as never} className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">Sign in</Link>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-5 text-sm">
              {error}
              <button onClick={() => void load()} className="ml-3 font-bold underline">Try again</button>
            </div>
          ) : items === null ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No trips yet. <Link to="/ride" className="font-bold text-primary">Book your first ride</Link>
            </div>
          ) : (
            items.map((r) => {
              const fare = r.fareFinal ?? r.fareEstimate;
              const isOpen = open === r.id;
              return (
                <div key={r.id} className="rounded-3xl border border-border bg-card">
                  <button onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen} className="flex w-full items-start gap-3 p-4 text-left">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.dropAddress ?? "Trip"}</p>
                      <p className="truncate text-xs text-muted-foreground">from {r.pickupAddress ?? "—"}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase">
                        <span className="rounded-full bg-muted px-2 py-0.5">{statusLabel[r.status] ?? r.status}</span>
                        {r.paymentMethod && <span className="rounded-full bg-muted px-2 py-0.5">{r.paymentMethod}</span>}
                        {r.paymentStatus && (
                          <span className={`rounded-full px-2 py-0.5 ${r.paymentStatus === "PAID" ? "bg-primary/15 text-primary" : "bg-muted"}`}>{r.paymentStatus}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold">{fare != null ? `₹${fare}` : "—"}</p>
                      <ChevronDown className={`ml-auto h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border p-4 text-xs text-muted-foreground">
                      <Detail k="Date" v={r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"} />
                      <Detail k="Vehicle" v={r.vehicleType ?? "—"} />
                      <Detail k="Distance" v={r.distanceMeters ? `${(r.distanceMeters / 1000).toFixed(1)} km` : "—"} />
                      <Detail k="Duration" v={r.durationSeconds ? `${Math.round(r.durationSeconds / 60)} min` : "—"} />
                      <Detail k="Estimated fare" v={r.fareEstimate != null ? `₹${r.fareEstimate}` : "—"} />
                      <Detail k="Final fare" v={r.fareFinal != null ? `₹${r.fareFinal}` : "—"} />
                      {(r.paymentIntents ?? []).map((p, i) => (
                        <Detail key={i} k={`Payment ${i + 1}`} v={p.status ?? "PENDING"} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <RoleNav />
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1">
      <span>{k}</span>
      <span className="font-semibold text-foreground">{v}</span>
    </div>
  );
}
