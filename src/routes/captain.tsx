import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RoleNav } from "@/components/rc/RoleNav";
import { storage, captainApi, api } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import type { Ride } from "@/lib/rides";

export const Route = createFileRoute("/captain")({
  head: () => ({
    meta: [
      { title: "Captain Portal — RIDEHER" },
      { name: "description", content: "Real-time ride requests, earnings, and community route submissions for RIDEHER captains." },
    ],
  }),
  component: CaptainPage,
});

const CAPTAIN = {
  name: "Rajesh K.",
  plate: "KA·05·MH·4421",
  vehicle: "Honda Activa · Yellow",
  rating: 4.94,
};

const leaderboard = [
  { name: "Rahul S.", trips: 34, saved: "142 min", rank: 1 },
  { name: "You", trips: 28, saved: "98 min", rank: 2 },
  { name: "Priya M.", trips: 27, saved: "89 min", rank: 3 },
  { name: "Anil K.", trips: 25, saved: "76 min", rank: 4 },
];

function CaptainPage() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<Ride[]>([]);
  const [active, setActive] = useState<Ride | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceIdRef = useRef<string>("");
  const userIdRef = useRef<string>("");

  useEffect(() => {
    deviceIdRef.current = getDeviceId();
    const user = storage.getUser();
    if (user) userIdRef.current = user.id;
  }, []);


  // Poll for rides
  useEffect(() => {
    if (!online) { setPending([]); return; }
    
    const poll = async () => {
       try {
         // This endpoint is an example, in reality we'd need a "GET /rides/available"
         const res = await api<any>("/rides?status=searching");
         setPending(res.data || []);

         const did = deviceIdRef.current || getDeviceId();
         // Another mock/example for getting active ride
         const activeRes = await api<any>(`/rides/active?deviceId=${did}`);
         if (activeRes.data) setActive(activeRes.data);
       } catch (e) {
         console.warn("Polling error", e);
       }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [online]);

  async function accept(ride: Ride) {
    setError(null);
    try {
      const response = await captainApi.accept(ride.id);
      setActive((response?.data ?? response) as Ride);
      setPending((p) => p.filter((r) => r.id !== ride.id));
    } catch (e: any) {
      setError(e.error?.message || "Accept failed");
    }
  }

  async function decline(rideId: string) {
    setPending((p) => p.filter((r) => r.id !== rideId));
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <RoleNav />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pb-8">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Captain portal</p>
            <h1 className="mt-2 truncate text-3xl font-extrabold tracking-tight md:text-4xl">Namaste, {CAPTAIN.name.split(" ")[0]}.</h1>
          </div>
          <button
            onClick={() => setOnline((v) => !v)}
            className={`shrink-0 rounded-full px-5 py-3 text-sm font-semibold ring-1 transition ${
              online ? "bg-accent text-accent-foreground ring-accent" : "bg-card text-foreground ring-border"
            }`}
          >
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${online ? "bg-white" : "bg-muted-foreground"}`} />
            {online ? "Online" : "Go online"}
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Today's earnings" value="₹1,240" sub="+18% vs yesterday" accent />
          <StatCard label="Trips completed" value="14" sub="6 community routes" />
          <StatCard label="Rating" value={CAPTAIN.rating.toFixed(2)} sub="last 30 days" />
          <StatCard label="Fuel bonus" value="₹340" sub="unlocked" />
        </div>

        {active && <ActiveRidePanel ride={active} />}

        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Incoming ride requests</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {online ? `Live · ${pending.length} nearby` : "Offline"}
              </span>
            </div>

            {error && <p className="mb-3 text-xs font-semibold text-destructive">{error}</p>}

            {!online && (
              <div className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">
                Go online to receive requests.
              </div>
            )}

            {online && pending.length === 0 && !active && (
              <div className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">
                Waiting for the next request…
              </div>
            )}

            <div className="space-y-3">
              {pending.map((r) => {
                const km = haversine(r.pickup_lat, r.pickup_lng, r.drop_lat, r.drop_lng).toFixed(1);
                return (
                  <div key={r.id} className="rounded-2xl border border-border p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                          <p className="truncate text-sm font-semibold">{r.pickup_label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 shrink-0 rounded-full bg-secondary" />
                          <p className="truncate text-sm font-semibold">{r.drop_label}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>{km} km</span>
                          <span>·</span>
                          <span>{r.vehicle_type}</span>
                          {r.use_smart_route && (
                            <span className="rounded bg-primary/20 px-1.5 py-0.5 font-bold text-secondary">
                              Community shortcut
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="text-2xl font-extrabold">₹{r.fare_inr}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => decline(r.id)}
                            className="rounded-full border border-border bg-background px-3 py-2 text-[10px] font-bold uppercase"
                          >
                            Pass
                          </button>
                          <button
                            onClick={() => accept(r)}
                            disabled={!!active}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-secondary transition-transform active:scale-95 disabled:opacity-50"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl bg-secondary p-5 text-secondary-foreground">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Submit route</p>
                  <p className="mt-1 text-lg font-bold">Discovered a shortcut on your last trip?</p>
                  <p className="mt-1 text-xs opacity-70">Earn ₹50 per verified route + long-term revenue share.</p>
                </div>
                <button className="shrink-0 rounded-full bg-primary px-5 py-3 text-xs font-bold text-secondary">
                  Submit →
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="mb-1 text-lg font-extrabold">Route discoverers</h2>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">This week</p>
            <div className="space-y-2">
              {leaderboard.map((p) => (
                <div
                  key={p.rank}
                  className={`flex items-center justify-between rounded-2xl p-3 ${p.name === "You" ? "bg-primary/20" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {p.rank}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">{p.trips} trips</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-accent">{p.saved}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ActiveRidePanel({ ride }: { ride: Ride }) {
  const km = haversine(ride.pickup_lat, ride.pickup_lng, ride.drop_lat, ride.drop_lng).toFixed(1);
  const stageLabel: Record<string, string> = {
    accepted: "Heading to pickup",
    arriving: "At pickup — collect OTP",
    in_progress: "En route to drop",
    completed: "Waiting for rider payment & rating",
    rated: "Complete",
  };
  return (
    <section className="mt-8 overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Active ride</p>
          <h2 className="mt-2 text-2xl font-extrabold">{stageLabel[ride.status] ?? ride.status}</h2>
          <p className="mt-1 text-xs text-secondary-foreground/60">
            {ride.pickup_label} → {ride.drop_label} · {km} km · ₹{ride.fare_inr}
          </p>
        </div>
        <div className="rounded-2xl bg-primary p-3 text-center text-secondary">
          <p className="font-mono text-[9px] font-bold uppercase">OTP</p>
          <p className="text-2xl font-extrabold tracking-widest">{ride.otp}</p>
        </div>
      </div>
      <p className="mt-4 text-[10px] font-mono uppercase text-secondary-foreground/50">
        The rider&apos;s screen advances automatically as you progress. Live location pings are sent every 1–2 seconds while accepted or in-progress.
      </p>
    </section>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl p-6 ${accent ? "bg-primary text-secondary" : "border border-border bg-card"}`}>
      <p className={`font-mono text-[10px] uppercase tracking-widest ${accent ? "opacity-70" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
      <p className={`mt-1 text-xs ${accent ? "opacity-70" : "text-muted-foreground"}`}>{sub}</p>
    </div>
  );
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
