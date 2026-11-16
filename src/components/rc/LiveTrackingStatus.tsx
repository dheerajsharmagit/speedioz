import type { TrackingFix, TrackingPhase } from "@/lib/live-tracking";
import { trackingIsFresh } from "@/lib/live-tracking";

export function LiveTrackingStatus({
  phase,
  fix,
  now,
  connected,
}: {
  phase: TrackingPhase;
  fix: TrackingFix | null;
  now: number;
  connected: boolean;
}) {
  const fresh = trackingIsFresh(fix, now);
  const age = fix?.at ? Math.max(0, Math.floor((now - Date.parse(fix.at)) / 1000)) : null;
  return (
    <div className="absolute left-4 top-24 z-[1000] max-w-[calc(100%-5.5rem)] rounded-2xl border border-border/60 bg-card/95 px-3 py-2.5 text-foreground shadow-lg backdrop-blur">
      <p className="text-xs font-bold">
        {phase === "pickup" ? "Captain approaching pickup" : "Live trip to your destination"}
      </p>
      <p
        role="status"
        aria-live="polite"
        className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${fresh ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        <span>
          1 captain assigned ·{" "}
          {!fix
            ? "Waiting for captain GPS…"
            : !fresh
              ? `GPS update delayed${age !== null ? ` · last update ${age}s ago` : ""}`
              : connected
                ? "Live location"
                : "Tracking via regular updates · reconnecting…"}
        </span>
      </p>
    </div>
  );
}
