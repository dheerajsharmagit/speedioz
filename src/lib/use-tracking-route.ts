import { useEffect, useRef, useState } from "react";
import { computeRoute } from "./routes.functions";
import { trackingIsFresh, type TrackingFix, type TrackingPhase } from "./live-tracking";

type RouteResult = Awaited<ReturnType<typeof computeRoute>>;
export function useTrackingRoute(input: {
  rideId: string | undefined;
  phase: TrackingPhase | null;
  fix: TrackingFix | null;
  target: { lat: number; lng: number };
  driving: boolean;
}) {
  const latest = useRef(input);
  latest.current = input;
  const [route, setRoute] = useState<
    (RouteResult & { phase: TrackingPhase; rideId: string }) | null
  >(null);
  const hasFix = !!input.fix;
  useEffect(() => {
    setRoute(null);
    if (!input.rideId || !input.phase || !hasFix) return;
    let disposed = false,
      fetching = false;
    let previous: TrackingFix | null = null;
    const refresh = async () => {
      const { fix, target, driving, rideId, phase } = latest.current;
      if (disposed || fetching || !fix || !rideId || !phase || !trackingIsFresh(fix)) return;
      if (previous && Math.hypot(fix.lat - previous.lat, fix.lng - previous.lng) < 0.0002) return;
      fetching = true;
      try {
        const result = await computeRoute({
          data: {
            origin: { lat: fix.lat, lng: fix.lng },
            destination: target,
            travelMode: driving ? "DRIVE" : "TWO_WHEELER",
          },
        });
        if (!disposed) {
          previous = fix;
          setRoute({ ...result, rideId, phase });
        }
      } catch {
        /* Retain the last road route and retry; GPS remains independent. */
      } finally {
        fetching = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [input.rideId, input.phase, input.target.lat, input.target.lng, input.driving, hasFix]);
  return route?.rideId === input.rideId && route?.phase === input.phase ? route : null;
}
