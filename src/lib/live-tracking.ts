export type TrackingPhase = "pickup" | "trip";
export type TrackingFix = { lat: number; lng: number; at: string | null; receivedAt: number };
export const GPS_STALE_MS = 20000;

export function trackingPhase(step: string): TrackingPhase | null {
  return ["matched", "arriving"].includes(step) ? "pickup" : step === "inprogress" ? "trip" : null;
}

/** Polls retain the server timestamp, so an old snapshot cannot rewind the map. */
export function mergeTrackingFix(
  current: TrackingFix | null,
  value: unknown,
  requestStartedAt = Date.now(),
  now = Date.now(),
): TrackingFix | null {
  if (!value || typeof value !== "object") return current;
  const fix = value as Record<string, unknown>;
  if (
    typeof fix.lat !== "number" ||
    typeof fix.lng !== "number" ||
    !Number.isFinite(fix.lat) ||
    !Number.isFinite(fix.lng) ||
    Math.abs(fix.lat) > 90 ||
    Math.abs(fix.lng) > 180
  )
    return current;
  const timestamp = typeof fix.at === "string" ? Date.parse(fix.at) : NaN;
  if (Number.isFinite(timestamp) && timestamp > now + 5000) return current;
  const previous = current?.at ? Date.parse(current.at) : NaN;
  if (
    current &&
    (Number.isFinite(previous)
      ? !Number.isFinite(timestamp) || timestamp <= previous
      : requestStartedAt < current.receivedAt)
  )
    return current;
  return {
    lat: fix.lat,
    lng: fix.lng,
    at: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    receivedAt: now,
  };
}

export function trackingIsFresh(fix: TrackingFix | null, now = Date.now()) {
  return !!fix?.at && now - Date.parse(fix.at) <= GPS_STALE_MS;
}

export function trackingTarget(
  phase: TrackingPhase | null,
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number },
) {
  return phase === "pickup" ? pickup : drop;
}
