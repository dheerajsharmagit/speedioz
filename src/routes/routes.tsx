import { useState } from "react";
import { sortCommunityRoutes, type RouteSort } from "@/lib/community";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleNav } from "@/components/rc/RoleNav";
import { RoutePreviewMap } from "@/components/rc/RoutePreviewMap";
import { api } from "@/lib/api";
import type { CommunityRoute } from "@/lib/rides";

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Community Routes — RIDEHER" },
      {
        name: "description",
        content: "Explore community routes by reported savings, safety, and location.",
      },
    ],
  }),
  component: RoutesPage,
});

function RoutesPage() {
  const [sort, setSort] = useState<RouteSort>("All routes");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  function selectSort(value: RouteSort) {
    if (value !== "Near me" || location) {
      setSort(value);
      setLocationError("");
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("Location is unavailable on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setSort(value);
        setLocationError("");
        setLocating(false);
      },
      () => {
        setLocationError("Enable location access to sort routes near you.");
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["community-routes"],
    queryFn: async () => {
      const res = await api<{ data: CommunityRoute[] }>("/community-routes");
      if (!Array.isArray(res.data)) throw new Error("Invalid route response");
      return res.data;
    },
  });

  return (
    <div className="min-h-screen bg-background pb-4 text-foreground">
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <header className="pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Community route intelligence
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-[0.95] tracking-tight md:text-6xl">
            Shortcuts your captains actually drive.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            Explore routes shared by the community. Scores and savings are supplied by the route
            service; current road conditions may differ.
          </p>
        </header>

        <div className="mb-8 flex flex-wrap gap-2">
          {["All routes", "Most saved time", "Highest safety", "Newest", "Near me"].map((f) => (
            <button
              key={f}
              onClick={() => selectSort(f as RouteSort)}
              aria-pressed={sort === f}
              disabled={locating}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                sort === f
                  ? "bg-secondary text-secondary-foreground"
                  : "border border-border bg-card"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {locationError && (
          <p role="alert" className="mb-4 text-sm">
            {locationError}
          </p>
        )}
        {locating && <p role="status">Finding your location…</p>}
        {isLoading && <SkeletonGrid />}
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Couldn&apos;t load routes.{" "}
            <button className="ml-2 underline" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        )}
        {data?.length === 0 && (
          <p className="rounded-2xl border p-6 text-sm">No community routes are available yet.</p>
        )}
        {data && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortCommunityRoutes(data, sort, location).map((r) => (
              <article
                key={r.id}
                className="animate-fade-up overflow-hidden rounded-3xl border border-border bg-card"
              >
                <div className="h-40 w-full bg-muted">
                  <RoutePreviewMap
                    encodedPolyline={r.encoded_polyline}
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
                    <Metric label="Reported verifications" value={`${r.verified_by} captains`} />
                    <Metric label="Time saved" value={`${r.savings_min} min`} />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Bar label="Safety" value={r.safety_score} />
                    <Bar label="Reported confidence" value={r.ai_confidence} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <RoleNav />
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
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-[9px] font-bold">{value}%</p>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
