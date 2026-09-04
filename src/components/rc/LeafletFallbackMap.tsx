import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "@/lib/polyline";
import { useTheme } from "@/lib/theme";

// NOTE: Leaflet touches `window` at import time, so it must be dynamically
// imported inside an effect. Importing it at module scope breaks SSR with
// "window is not defined" and causes the whole /ride route to fall back to
// client rendering (which leaves the map blank).
type LeafletNS = typeof import("leaflet");
type LMap = import("leaflet").Map;
type LMarker = import("leaflet").Marker;
type LPolyline = import("leaflet").Polyline;

type LatLng = { lat: number; lng: number };

interface Props {
  pickup: LatLng;
  drop: LatLng;
  captain?: LatLng | null;
  userLocation?: LatLng | null;
  polyline?: string;
  className?: string;
  fitKey?: string;
  routeLoading?: boolean;
  routeError?: string | null;
}

function makeDot(L: LeafletNS, color: string, stroke: string, size = 16) {
  const html = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${stroke};box-shadow:0 1px 3px rgba(0,0,0,.25)"></div>`;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export function LeafletFallbackMap({ 
  pickup, 
  drop, 
  captain, 
  userLocation, 
  polyline, 
  className, 
  fitKey,
  routeLoading,
  routeError 
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const pickupRef = useRef<LMarker | null>(null);
  const dropRef = useRef<LMarker | null>(null);
  const captainRef = useRef<LMarker | null>(null);
  const userRef = useRef<LMarker | null>(null);
  const polyRef = useRef<LPolyline | null>(null);
  const readyRef = useRef(false);
  const [roadFallbackPolyline, setRoadFallbackPolyline] = useState("");
  const { markers } = useTheme();

  // Google routing can be unavailable on a deployed customer portal. Fetch a
  // road-following geometry directly for the Leaflet backup map instead of
  // drawing an aerial line between the markers. OSRM enables browser CORS.
  useEffect(() => {
    if (polyline) {
      setRoadFallbackPolyline("");
      return;
    }
    const origin = captain ?? pickup;
    const destination = captain ? pickup : drop;
    if (origin.lat === destination.lat && origin.lng === destination.lng) return;
    let cancelled = false;
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;
    void fetch(url)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Route request failed (${response.status})`)))
      .then((payload: { routes?: Array<{ geometry?: string }> }) => {
        if (!cancelled) setRoadFallbackPolyline(payload.routes?.[0]?.geometry ?? "");
      })
      .catch(() => {
        if (!cancelled) setRoadFallbackPolyline("");
      });
    return () => { cancelled = true; };
  }, [polyline, captain?.lat, captain?.lng, pickup.lat, pickup.lng, drop.lat, drop.lng]);

  // Track latest values so the async init effect uses current data.
  const effectivePolyline = polyline || roadFallbackPolyline;
  const stateRef = useRef({ pickup, drop, captain, userLocation, polyline: effectivePolyline, markers });
  stateRef.current = { pickup, drop, captain, userLocation, polyline: effectivePolyline, markers };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod.default ?? mod) as LeafletNS;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
        [stateRef.current.pickup.lat, stateRef.current.pickup.lng],
        13,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      mapRef.current = map;
      readyRef.current = true;
      // Nudge in case initial size was 0.
      setTimeout(() => map.invalidateSize(), 50);
      // Force re-run of dependent effects by touching a state we control.
      // We just call the sync logic directly here.
      applyMarkers();
      applyPolyline();
      applyBounds();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyMarkers() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const { pickup, drop, captain, userLocation, markers } = stateRef.current;
    if (!pickupRef.current) pickupRef.current = L.marker([pickup.lat, pickup.lng], { icon: makeDot(L, markers.pickupFill, markers.pickupStroke) }).addTo(map);
    else pickupRef.current.setLatLng([pickup.lat, pickup.lng]).setIcon(makeDot(L, markers.pickupFill, markers.pickupStroke));

    if (!dropRef.current) dropRef.current = L.marker([drop.lat, drop.lng], { icon: makeDot(L, markers.dropFill, markers.dropStroke) }).addTo(map);
    else dropRef.current.setLatLng([drop.lat, drop.lng]).setIcon(makeDot(L, markers.dropFill, markers.dropStroke));

    if (captain) {
      if (!captainRef.current) captainRef.current = L.marker([captain.lat, captain.lng], { icon: makeDot(L, "#EF4444", "#991B1B", 18) }).addTo(map);
      else captainRef.current.setLatLng([captain.lat, captain.lng]).setIcon(makeDot(L, "#EF4444", "#991B1B", 18));
    } else if (captainRef.current) {
      captainRef.current.remove();
      captainRef.current = null;
    }

    if (userLocation) {
      if (!userRef.current) userRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: makeDot(L, "#EC4899", "#ffffff", 14) }).addTo(map);
      else userRef.current.setLatLng([userLocation.lat, userLocation.lng]).setIcon(makeDot(L, "#EC4899", "#ffffff", 14));
    } else if (userRef.current) {
      userRef.current.remove();
      userRef.current = null;
    }
  }

  function applyPolyline() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const { polyline, markers, captain } = stateRef.current;
    
    // Clear old polylines
    if ((map as any)._ridePolylines) {
      (map as any)._ridePolylines.forEach((p: any) => p.remove());
    }
    (map as any)._ridePolylines = [];

    let path: LatLng[] = [];
    if (polyline) {
      path = decodePolyline(polyline);
    } else if (pickup.lat !== drop.lat || pickup.lng !== drop.lng) {
      path = [pickup, drop];
    }

    if (path.length > 1) {
        // Find split point for traveled vs remaining
        const splitIdx = captain ? nearestIndex(path, captain) : 0;
        const traveled = splitIdx > 0 ? path.slice(0, splitIdx + 1) : [];
        const remaining = path.slice(Math.max(0, splitIdx));

        if (traveled.length > 1) {
          const tPoly = L.polyline(
            traveled.map((p) => [p.lat, p.lng] as [number, number]),
            { color: markers.routeTraveled, weight: 4, opacity: 0.75, dashArray: "5, 8" }
          ).addTo(map);
          (map as any)._ridePolylines.push(tPoly);
        }
        
        const rPoly = L.polyline(
          remaining.map((p) => [p.lat, p.lng] as [number, number]),
          { color: markers.routeStroke, weight: 6, opacity: 0.95 }
        ).addTo(map);
        (map as any)._ridePolylines.push(rPoly);
      }
  }

  function nearestIndex(path: LatLng[], p: LatLng): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < path.length; i++) {
      const dx = path[i].lat - p.lat;
      const dy = path[i].lng - p.lng;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function applyBounds() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const { pickup, drop, captain, polyline } = stateRef.current;
    const pts: [number, number][] = [[pickup.lat, pickup.lng], [drop.lat, drop.lng]];
    if (captain) pts.push([captain.lat, captain.lng]);
    if (polyline) for (const p of decodePolyline(polyline)) pts.push([p.lat, p.lng]);
    if (pts.length >= 2 && (pickup.lat !== drop.lat || pickup.lng !== drop.lng)) {
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60] });
    } else {
      map.setView([pickup.lat, pickup.lng], 15);
    }
  }

  useEffect(() => { if (readyRef.current) applyMarkers(); }, [pickup, drop, captain, userLocation, markers]);
  useEffect(() => { if (readyRef.current) applyPolyline(); }, [effectivePolyline, markers, captain]);
  useEffect(() => { if (readyRef.current) applyBounds(); }, [pickup, drop, captain, polyline, fitKey]);

  return (
    <div className={className ?? "relative h-full w-full"}>
      <div ref={containerRef} className="absolute inset-0 bg-muted" />
      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-background/90 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground shadow-sm">
        Fallback map
      </div>

      {/* Loading State Overlay */}
      {routeLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/90 px-6 py-4 shadow-xl border border-border/50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs font-semibold tracking-wide text-foreground/80">Calculating route...</span>
          </div>
        </div>
      )}

      {/* Error State Overlay */}
      {routeError && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/95 px-6 py-4 shadow-xl border border-destructive/20 max-w-[80%] text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <span className="text-xl">!</span>
            </div>
            <span className="text-sm font-bold text-foreground">Route Unavailable</span>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{routeError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
