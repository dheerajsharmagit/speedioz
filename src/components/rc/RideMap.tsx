import { useEffect, useRef, useState } from "react";
import {
  type GoogleMap,
  type GoogleMarker,
  type GooglePolyline,
  loadGoogleMaps,
  resetGoogleMapsLoader,
  onGoogleMapsAuthFailure,
} from "@/lib/google-maps-loader";

import { useTheme } from "@/lib/theme";



type LatLng = { lat: number; lng: number };

interface RideMapProps {
  pickup: LatLng;
  drop: LatLng;
  captain?: LatLng | null;
  nearbyCaptains?: LatLng[];
  userLocation?: LatLng | null;
  polyline?: string; // encoded polyline (full active route)
  className?: string;
  /** Any string that changes when we want the map to re-fit its bounds (e.g. UI step). */
  fitKey?: string;
  /** Bump this number to smoothly pan the map to `recenterTarget`. */
  recenterKey?: number;
  recenterTarget?: LatLng | null;
  routeLoading?: boolean;
  routeError?: string | null;
}

function nearestIndex(path: LatLng[], p: LatLng): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const dx = path[i].lat - p.lat;
    const dy = path[i].lng - p.lng;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function RideMap({ 
  pickup, 
  drop, 
  captain, 
  nearbyCaptains = [],
  userLocation, 
  polyline, 
  className, 
  fitKey, 
  recenterKey, 
  recenterTarget,
  routeLoading,
  routeError
}: RideMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const pickupMarkerRef = useRef<GoogleMarker | null>(null);
  const dropMarkerRef = useRef<GoogleMarker | null>(null);
  const captainMarkerRef = useRef<GoogleMarker | null>(null);
  const nearbyCaptainMarkersRef = useRef<GoogleMarker[]>([]);
  const userMarkerRef = useRef<GoogleMarker | null>(null);
  const userAccuracyRef = useRef<GoogleMarker | null>(null);
  const polylineRef = useRef<GooglePolyline | null>(null);
  const traveledRef = useRef<GooglePolyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const { markers, version } = useTheme();
  const markersRef = useRef(markers);
  markersRef.current = markers;


  // Init map once
  useEffect(() => {
    let cancelled = false;
    let tileCheck: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const g = await loadGoogleMaps().catch((e: unknown) => {
        console.error("Google Maps failed to load", e);
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Map failed to load");
        return null;
      });
      if (cancelled || !g || !containerRef.current) return;

      // Google Maps renders into a collapsed box (blank grey) if the container
      // has no size at construction time. Wait for a real size first.
      const el = containerRef.current;
      for (let i = 0; i < 40; i++) {
        if (cancelled) return;
        if (el.clientWidth > 0 && el.clientHeight > 0) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled || !containerRef.current) return;

      mapRef.current = new g.maps.Map(containerRef.current, {
        center: pickup,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        ],
      });

      // Surface an actionable error rather than switching map providers.
      tileCheck = setTimeout(() => {
        if (cancelled) return;
        const painted = containerRef.current?.querySelector(".gm-style");
        if (!painted) setLoadError("Google Maps did not render on this device");
      }, 4000);


      pickupMarkerRef.current = new g.maps.Marker({
        position: pickup,
        map: mapRef.current,
        title: "Pickup",
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: markersRef.current.pickupFill,
          fillOpacity: 1,
          strokeColor: markersRef.current.pickupStroke,
          strokeWeight: 2,
        },
      });

      dropMarkerRef.current = new g.maps.Marker({
        position: drop,
        map: mapRef.current,
        title: "Drop",
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: markersRef.current.dropFill,
          fillOpacity: 1,
          strokeColor: markersRef.current.dropStroke,
          strokeWeight: 2,
        },
      });

      // Fit bounds
      const bounds = new g.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(drop);
      mapRef.current.fitBounds(bounds, 60);
      setMapReady(true);
    })();
    const offAuth = onGoogleMapsAuthFailure(() => {
      if (cancelled) return;
      setLoadError("Google Maps authentication failed for this domain");
    });

    return () => {
      cancelled = true;
      if (tileCheck) clearTimeout(tileCheck);
      offAuth();
      pickupMarkerRef.current?.setMap(null);
      dropMarkerRef.current?.setMap(null);
      captainMarkerRef.current?.setMap(null);
      userMarkerRef.current?.setMap(null);
      userAccuracyRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
      traveledRef.current?.setMap(null);
      mapRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  // Keep the map painted when its container changes size (bottom-sheet layout,
  // step transitions, orientation changes). Without this, a map constructed in
  // a small/collapsed box stays visually blank.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last = { w: el.clientWidth, h: el.clientHeight };
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === last.w && h === last.h) return;
      last = { w, h };
      if (!mapRef.current || w === 0 || h === 0) return;
      const g = window.google;
      if (!g) return;
      // Nudge Google Maps to re-measure, then restore framing.
      window.dispatchEvent(new Event("resize"));
      const bounds = new g.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(drop);
      if (captain) bounds.extend(captain);
      for (const pt of pathRef.current) bounds.extend(pt);
      mapRef.current.fitBounds(bounds, 60);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);



  // Decode polyline once per change and keep it for both drawing and bounds fitting.
  const pathRef = useRef<LatLng[]>([]);

  // Update pickup / drop positions (no fitting here — dedicated effect below).
  useEffect(() => {
    pickupMarkerRef.current?.setPosition(pickup);
    dropMarkerRef.current?.setPosition(drop);
  }, [pickup, drop]);

  // Update polyline — split into traveled (behind captain) + remaining ahead
  useEffect(() => {
    const g = window.google;
    if (!mapRef.current || !g) return;
    polylineRef.current?.setMap(null);
    traveledRef.current?.setMap(null);
    polylineRef.current = null;
    traveledRef.current = null;
    pathRef.current = [];
    if (!polyline) {
      // If no polyline, draw a straight line between pickup and drop as fallback
      pathRef.current = [pickup, drop];
    } else {
      const decoded = g.maps.geometry.encoding.decodePath(polyline);
      if (!decoded || decoded.length === 0) {
        pathRef.current = [pickup, drop];
      } else {
        pathRef.current = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
      }
    }
    const path = pathRef.current;

    const splitIdx = captain ? nearestIndex(path, captain) : 0;
    const traveled = splitIdx > 0 ? path.slice(0, splitIdx + 1) : [];
    const remaining = path.slice(Math.max(0, splitIdx));

    if (traveled.length > 1) {
      traveledRef.current = new g.maps.Polyline({
        path: traveled,
        strokeColor: markersRef.current.routeTraveled,
        strokeOpacity: 0.75,
        strokeWeight: 4,
        map: mapRef.current,
      });
    }
    polylineRef.current = new g.maps.Polyline({
      path: remaining,
      strokeColor: markersRef.current.routeStroke,
      strokeOpacity: 0.95,
      strokeWeight: 6,
      map: mapRef.current,
    });
  }, [polyline, captain, mapReady, version]);

  // Auto-fit bounds around pickup, drop, captain, AND the full route polyline.
  // Re-runs whenever any of these change or the parent bumps `fitKey` (e.g. step change).
  useEffect(() => {
    const g = window.google;
    if (!mapRef.current || !g) return;
    const map = mapRef.current as unknown as {
      setCenter: (p: LatLng) => void;
      setZoom: (z: number) => void;
      fitBounds: (b: unknown, padding?: number | object) => void;
    };
    const same = pickup.lat === drop.lat && pickup.lng === drop.lng && !captain && pathRef.current.length === 0;
    if (same) {
      map.setCenter(pickup);
      map.setZoom(15);
      return;
    }
    const bounds = new g.maps.LatLngBounds();
    bounds.extend(pickup);
    bounds.extend(drop);
    if (captain) bounds.extend(captain);
    for (const pt of pathRef.current) bounds.extend(pt);
    map.fitBounds(bounds, { top: 120, bottom: 80, left: 60, right: 60 } as unknown as number);
  }, [pickup, drop, captain, polyline, fitKey, mapReady]);


  // Update captain marker
  useEffect(() => {
    const g = window.google;
    if (!mapRef.current || !g) return;
    if (!captain) {
      captainMarkerRef.current?.setMap(null);
      captainMarkerRef.current = null;
      return;
    }
    if (!captainMarkerRef.current) {
      captainMarkerRef.current = new g.maps.Marker({
        position: captain,
        map: mapRef.current,
        title: "Captain",
        icon: {
          path: "M -6 -3 L 6 -3 L 8 0 L 6 3 L -6 3 L -8 0 Z",
          scale: 1.4,
          fillColor: "#EF4444",
          fillOpacity: 1,
          strokeColor: "#991B1B",
          strokeWeight: 2,
          rotation: 0,
        },
      });
    } else {
      captainMarkerRef.current.setPosition(captain);
    }
  }, [captain]);

  // Availability scooters are approximate, anonymous nearby captain markers.
  useEffect(() => {
    const g = window.google;
    if (!mapRef.current || !g) return;
    nearbyCaptainMarkersRef.current.forEach((marker) => marker.setMap(null));
    nearbyCaptainMarkersRef.current = nearbyCaptains.map((position) => new g.maps.Marker({
      position,
      map: mapRef.current,
      title: "Available captain nearby",
      clickable: false,
      zIndex: 3,
      label: { text: "🛵", fontSize: "18px" },
    }));
  }, [nearbyCaptains, mapReady]);

  // User's live location marker (blue dot).
  useEffect(() => {
    const g = window.google;
    if (!mapRef.current || !g) return;
    if (!userLocation) {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      userAccuracyRef.current?.setMap(null);
      userAccuracyRef.current = null;
      return;
    }
    if (!userAccuracyRef.current) {
      userAccuracyRef.current = new g.maps.Marker({
        position: userLocation,
        map: mapRef.current,
        clickable: false,
        zIndex: 5,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 22,
          fillColor: "#EC4899",
          fillOpacity: 0.15,
          strokeColor: "#EC4899",
          strokeOpacity: 0.25,
          strokeWeight: 1,
        },
      });
    } else {
      userAccuracyRef.current.setPosition(userLocation);
    }
    if (!userMarkerRef.current) {
      userMarkerRef.current = new g.maps.Marker({
        position: userLocation,
        map: mapRef.current,
        title: "Your location",
        zIndex: 6,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#EC4899",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    } else {
      userMarkerRef.current.setPosition(userLocation);
    }
  }, [userLocation, mapReady]);

  // Re-apply marker icons when theme (mode/intensity) changes.
  useEffect(() => {
    const g = window.google;
    if (!g || !mapReady) return;
    pickupMarkerRef.current?.setIcon({
      path: g.maps.SymbolPath.CIRCLE, scale: 9,
      fillColor: markers.pickupFill, fillOpacity: 1,
      strokeColor: markers.pickupStroke, strokeWeight: 2,
    });
    dropMarkerRef.current?.setIcon({
      path: g.maps.SymbolPath.CIRCLE, scale: 9,
      fillColor: markers.dropFill, fillOpacity: 1,
      strokeColor: markers.dropStroke, strokeWeight: 2,
    });
    captainMarkerRef.current?.setIcon({
      path: "M -6 -3 L 6 -3 L 8 0 L 6 3 L -6 3 L -8 0 Z", scale: 1.4,
      fillColor: "#EF4444", fillOpacity: 1,
      strokeColor: "#991B1B", strokeWeight: 2, rotation: 0,
    });
    userMarkerRef.current?.setIcon({
      path: g.maps.SymbolPath.CIRCLE, scale: 7,
      fillColor: "#EC4899", fillOpacity: 1,
      strokeColor: "#ffffff", strokeWeight: 2,
    });
    userAccuracyRef.current?.setIcon({
      path: g.maps.SymbolPath.CIRCLE, scale: 22,
      fillColor: "#EC4899", fillOpacity: 0.15,
      strokeColor: "#EC4899", strokeOpacity: 0.25, strokeWeight: 1,
    });
  }, [markers, mapReady]);

  // Smooth recenter when parent bumps recenterKey.
  useEffect(() => {
    if (recenterKey === undefined) return;
    if (!mapRef.current || !recenterTarget) return;
    mapRef.current.panTo(recenterTarget);
    const z = mapRef.current.getZoom?.();
    if (typeof z === "number" && z < 15) mapRef.current.setZoom(16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  if (loadError) {
    return (
      <div className={`${className ?? "relative h-full w-full"} grid place-items-center bg-muted p-5`}>
        <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-2xl bg-background p-4 text-center shadow-md">
          <span className="text-xs font-semibold text-muted-foreground">Google Maps is unavailable. Check the API key and allowed domain.</span>
          <button
            onClick={() => { resetGoogleMapsLoader(); setLoadError(null); setMapReady(false); setRetryTick((n) => n + 1); }}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-secondary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className ?? "relative h-full w-full"}>
      <div ref={containerRef} className="absolute inset-0 bg-muted" />
      
      {/* Loading State Overlays */}
      {routeLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/90 px-6 py-4 shadow-xl border border-border/50 animate-in fade-in zoom-in duration-300">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs font-semibold tracking-wide text-foreground/80">Calculating route...</span>
          </div>
        </div>
      )}

      {/* Error State Overlay */}
      {routeError && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/95 px-6 py-4 shadow-xl border border-destructive/20 animate-in fade-in zoom-in duration-300 max-w-[80%] text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <span className="text-xl">!</span>
            </div>
            <span className="text-sm font-bold text-foreground">Route Unavailable</span>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{routeError}</p>
          </div>
        </div>
      )}

      {/* Empty State / Prompt */}
      {!polyline && !routeLoading && !routeError && pickup.lat === drop.lat && pickup.lng === drop.lng && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 pointer-events-none">
          <div className="rounded-full bg-background/95 px-4 py-2 shadow-lg border border-border/50 animate-in slide-in-from-top-4 duration-500">
             <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Choose a destination to see the route</span>
          </div>
        </div>
      )}
    </div>
  );
}
