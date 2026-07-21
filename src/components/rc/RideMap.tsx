import { useEffect, useRef, useState } from "react";
import {
  type GoogleMap,
  type GoogleMarker,
  type GooglePolyline,
  loadGoogleMaps,
} from "@/lib/google-maps-loader";

type LatLng = { lat: number; lng: number };

interface RideMapProps {
  pickup: LatLng;
  drop: LatLng;
  captain?: LatLng | null;
  polyline?: string; // encoded polyline (full active route)
  className?: string;
  /** Any string that changes when we want the map to re-fit its bounds (e.g. UI step). */
  fitKey?: string;
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

export function RideMap({ pickup, drop, captain, polyline, className, fitKey }: RideMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const pickupMarkerRef = useRef<GoogleMarker | null>(null);
  const dropMarkerRef = useRef<GoogleMarker | null>(null);
  const captainMarkerRef = useRef<GoogleMarker | null>(null);
  const polylineRef = useRef<GooglePolyline | null>(null);
  const traveledRef = useRef<GooglePolyline | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const g = await loadGoogleMaps().catch((e) => {
        console.error(e);
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
          fillColor: "#FFD400",
          fillOpacity: 1,
          strokeColor: "#111827",
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
          fillColor: "#111827",
          fillOpacity: 1,
          strokeColor: "#FFD400",
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
    return () => {
      cancelled = true;
      pickupMarkerRef.current?.setMap(null);
      dropMarkerRef.current?.setMap(null);
      captainMarkerRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
      traveledRef.current?.setMap(null);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        strokeColor: "#9ca3af",
        strokeOpacity: 0.7,
        strokeWeight: 4,
        map: mapRef.current,
      });
    }
    polylineRef.current = new g.maps.Polyline({
      path: remaining,
      strokeColor: "#111827",
      strokeOpacity: 0.95,
      strokeWeight: 6,
      map: mapRef.current,
    });
  }, [polyline, captain, mapReady]);

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
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#052e16",
          strokeWeight: 2,
          rotation: 0,
        },
      });
    } else {
      captainMarkerRef.current.setPosition(captain);
    }
  }, [captain]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
