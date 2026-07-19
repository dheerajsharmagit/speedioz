import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleNav } from "@/components/rc/RoleNav";
import { RoutePreviewMap } from "@/components/rc/RoutePreviewMap";
import { supabase } from "@/integrations/supabase/client";
import type { CommunityRoute } from "@/lib/rides";

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Community Routes — RideConnect AI" },
      { name: "description", content: "Captain-verified shortcuts that beat Google Maps. Ranked by time saved, safety, and confidence." },
    ],
  }),
  component: RoutesPage,
});

function RoutesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["community-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_routes")
        .select("*")
        .order("savings_min", { ascending: false });
      if (error) throw error;
      return data as CommunityRoute[];
    },
  });

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

        {isLoading && <SkeletonGrid />}
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Couldn&apos;t load routes.
          </div>
        )}
        {data && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((r) => (
              <article key={r.id} className="animate-fade-up overflow-hidden rounded-3xl border border-border bg-card">
                <div className="h-40 w-full bg-muted">
                  <RoutePreviewMap
                    from={{ lat: r.from_lat, lng: r.from_lng }}
                    to={{ lat: r.to_lat, lng: r.to_lng }}
                    className="h-40 w-full"
                  />
                </div>
                <div className="p-6">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-base font-extrabold leading-tight">{r.title}</h3>
                    <span className="shrink-0 rounded bg-accent/15 px-2 py-1 font-mono text-[10px] font-bold uppercase text-accent">
                      −{r.savings_min}m
                    </span>
                  </div>

                  <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.from_label} → {r.to_label}
                  </p>

                  <div className="grid grid-cols-2 gap-3 border-y border-border py-3">
                    <Metric label="Verified by" value={`${r.verified_by} captains`} />
                    <Metric label="Time saved" value={`${r.savings_min} min`} />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Bar label="Safety" value={r.safety_score} />
                    <Bar label="AI confidence" value={r.ai_confidence} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-80 animate-pulse rounded-3xl bg-muted" />
      ))}
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
