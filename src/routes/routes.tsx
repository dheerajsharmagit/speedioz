import { createFileRoute } from "@tanstack/react-router";
import { RoleNav } from "@/components/rc/RoleNav";

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Community Routes — RideConnect AI" },
      { name: "description", content: "Captain-verified shortcuts that beat Google Maps. Ranked by time saved, safety, and confidence." },
    ],
  }),
  component: RoutesPage,
});

const communityRoutes = [
  { name: "MG Road → Cubbon Park via Kasturba", km: 2.4, time: 8, saved: 6, votes: 214, uses: 1820, safety: 96, ai: 94, captain: "Rahul S." },
  { name: "HSR → Koramangala via 27th Main", km: 4.1, time: 11, saved: 9, votes: 342, uses: 4120, safety: 98, ai: 97, captain: "Priya M." },
  { name: "Airport → Hebbal via Trumpet B", km: 21.4, time: 22, saved: 14, votes: 89, uses: 612, safety: 92, ai: 88, captain: "Anil K." },
  { name: "Silk Board → BTM via service lane", km: 3.2, time: 9, saved: 11, votes: 421, uses: 5240, safety: 94, ai: 96, captain: "Deepa V." },
  { name: "Whitefield → Marathahalli via ITPL back", km: 6.8, time: 14, saved: 8, votes: 156, uses: 1104, safety: 90, ai: 91, captain: "Karthik R." },
  { name: "Yeshwanthpur → Rajaji Nagar via 8th cross", km: 3.9, time: 10, saved: 7, votes: 98, uses: 720, safety: 95, ai: 89, captain: "Neha B." },
];

function RoutesPage() {
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <RoleNav />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <header className="pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Community route intelligence</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-[0.95] tracking-tight md:text-6xl">
            Shortcuts your captains actually drive.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            Every route below is verified by real trips, cross-checked by our AI, and scored on
            safety, road quality, and time saved. Google won&apos;t show you these.
          </p>
        </header>

        <div className="mb-8 flex flex-wrap gap-2">
          {["All routes", "Most saved time", "Highest safety", "Newest", "Near me"].map((f, i) => (
            <button
              key={f}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                i === 0 ? "bg-secondary text-secondary-foreground" : "border border-border bg-card"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {communityRoutes.map((r) => (
            <article key={r.name} className="animate-fade-up rounded-3xl border border-border bg-card p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="text-base font-extrabold leading-tight">{r.name}</h3>
                <span className="shrink-0 rounded bg-accent/15 px-2 py-1 font-mono text-[10px] font-bold uppercase text-accent">
                  −{r.saved}m
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 border-y border-border py-4">
                <Metric label="Distance" value={`${r.km} km`} />
                <Metric label="Time" value={`${r.time} min`} />
                <Metric label="Uses" value={r.uses.toLocaleString()} />
              </div>

              <div className="mt-4 space-y-2">
                <Bar label="Safety" value={r.safety} />
                <Bar label="AI confidence" value={r.ai} />
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">by {r.captain}</p>
                <p className="font-mono text-[10px] font-bold uppercase text-secondary">↑ {r.votes}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-mono text-[9px] font-bold">{value}%</p>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
