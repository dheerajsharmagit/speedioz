import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  type GoogleMap,
  type GoogleMarker,
  type GooglePolyline,
  loadGoogleMaps,
  resetGoogleMapsLoader,
  onGoogleMapsAuthFailure,
} from "@/lib/google-maps-loader";

import { useTheme } from "@/lib/theme";

// Lazy so Leaflet (which touches `window` at import time) never loads on the
// server. Importing it eagerly breaks SSR of the /ride route.
const LeafletFallbackMap = lazy(() =>
  import("./LeafletFallbackMap").then((m) => ({ default: m.LeafletFallbackMap })),
);



type LatLng = { lat: number; lng: number };

interface RideMapProps {
  pickup: LatLng;
  drop: LatLng;
  captain?: LatLng | null;
  userLocation?: LatLng | null;
  polyline?: string; // encoded polyline (full active route)
  className?: string;
  /** Any string that changes when we want the map to re-fit its bounds (e.g. UI step). */
  fitKey?: string;
  /** Bump this number to smoothly pan the map to `recenterTarget`. */
  recenterKey?: number;
  recenterTarget?: LatLng | null;
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

export function RideMap({ pickup, drop, captain, userLocation, polyline, className, fitKey, recenterKey, recenterTarget }: RideMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const pickupMarkerRef = useRef<GoogleMarker | null>(null);
  const dropMarkerRef = useRef<GoogleMarker | null>(null);
  const captainMarkerRef = useRef<GoogleMarker | null>(null);
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
    (async () => {
      const g = await loadGoogleMaps().catch((e: unknown) => {
        console.error("Google Maps failed to load", e);
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Map failed to load");
        return null;
      });
      if (cancelled || !g || !containerRef.current) return;


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
    if (!polyline) return;

    const decoded = g.maps.geometry.encoding.decodePath(polyline);
    if (!decoded || decoded.length === 0) return;
    const path: LatLng[] = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
    pathRef.current = path;

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
          fillColor: markersRef.current.captainFill,
          fillOpacity: 1,
          strokeColor: markersRef.current.captainStroke,
          strokeWeight: 2,
          rotation: 0,
        },
      });
    } else {
      captainMarkerRef.current.setPosition(captain);
    }
  }, [captain]);

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
          fillColor: markersRef.current.userFill,
          fillOpacity: 0.15,
          strokeColor: markersRef.current.userFill,
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
          fillColor: markersRef.current.userFill,
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
      fillColor: markers.captainFill, fillOpacity: 1,
      strokeColor: markers.captainStroke, strokeWeight: 2, rotation: 0,
    });
    userMarkerRef.current?.setIcon({
      path: g.maps.SymbolPath.CIRCLE, scale: 7,
      fillColor: markers.userFill, fillOpacity: 1,
      strokeColor: "#ffffff", strokeWeight: 2,
    });
    userAccuracyRef.current?.setIcon({
      path: g.maps.SymbolPath.CIRCLE, scale: 22,
      fillColor: markers.userFill, fillOpacity: 0.15,
      strokeColor: markers.userFill, strokeOpacity: 0.25, strokeWeight: 1,
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
      <div className={className ?? "h-full w-full"} style={{ position: "relative" }}>
        <Suspense fallback={<div className="absolute inset-0 bg-muted" />}>
          <LeafletFallbackMap
            pickup={pickup}
            drop={drop}
            captain={captain}
            userLocation={userLocation}
            polyline={polyline}
            className="absolute inset-0"
            fitKey={fitKey}
          />
        </Suspense>

        <div className="pointer-events-auto absolute right-2 top-2 flex items-center gap-2 rounded-full bg-background/95 px-3 py-1.5 text-[11px] shadow-md">
          <span className="text-muted-foreground">Using backup map</span>
          <button
            onClick={() => { resetGoogleMapsLoader(); setLoadError(null); setMapReady(false); setRetryTick((n) => n + 1); }}
            className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-secondary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? "h-full w-full"}`}>
      <div ref={containerRef} className="absolute inset-0 bg-muted" />
    </div>
  );
}



