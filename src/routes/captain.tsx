import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RoleNav } from "@/components/rc/RoleNav";

export const Route = createFileRoute("/captain")({
  head: () => ({
    meta: [
      { title: "Captain Portal — RideConnect AI" },
      { name: "description", content: "Earnings, ride requests, and community route submissions for RideConnect captains." },
    ],
  }),
  component: CaptainPage,
});

const requests = [
  { id: "r1", from: "HSR Layout, Sector 2", to: "Koramangala 5th Block", km: 4.2, fare: 68, community: true },
  { id: "r2", from: "Indiranagar Metro", to: "MG Road", km: 6.8, fare: 105 },
  { id: "r3", from: "Manyata Tech Park", to: "Hebbal Flyover", km: 3.4, fare: 55, community: true },
];

const leaderboard = [
  { name: "Rahul S.", trips: 34, saved: "142 min", rank: 1 },
  { name: "You", trips: 28, saved: "98 min", rank: 2 },
  { name: "Priya M.", trips: 27, saved: "89 min", rank: 3 },
  { name: "Anil K.", trips: 25, saved: "76 min", rank: 4 },
];

function CaptainPage() {
  const [online, setOnline] = useState(true);
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <RoleNav />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pb-8">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Captain portal</p>
            <h1 className="mt-2 truncate text-3xl font-extrabold tracking-tight md:text-4xl">Namaste, Ravi.</h1>
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
          <StatCard label="Rating" value="4.94" sub="last 30 days" />
          <StatCard label="Fuel bonus" value="₹340" sub="unlocked" />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Incoming ride requests</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Live · {requests.length} nearby
              </span>
            </div>
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                        <p className="truncate text-sm font-semibold">{r.from}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 shrink-0 rounded-full bg-secondary" />
                        <p className="truncate text-sm font-semibold">{r.to}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{r.km} km</span>
                        <span>·</span>
                        <span>≈ 12 min</span>
                        {r.community && (
                          <span className="rounded bg-primary/20 px-1.5 py-0.5 font-bold text-secondary">
                            Community shortcut
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="text-2xl font-extrabold">₹{r.fare}</p>
                      <button className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-secondary transition-transform active:scale-95">
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
