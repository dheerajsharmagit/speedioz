import { useEffect, useRef } from "react";
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
  polyline?: string; // encoded polyline
  className?: string;
}

export function RideMap({ pickup, drop, captain, polyline, className }: RideMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const pickupMarkerRef = useRef<GoogleMarker | null>(null);
  const dropMarkerRef = useRef<GoogleMarker | null>(null);
  const captainMarkerRef = useRef<GoogleMarker | null>(null);
  const polylineRef = useRef<GooglePolyline | null>(null);

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
    })();
    return () => {
      cancelled = true;
      pickupMarkerRef.current?.setMap(null);
      dropMarkerRef.current?.setMap(null);
      captainMarkerRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update pickup / drop positions
  useEffect(() => {
    pickupMarkerRef.current?.setPosition(pickup);
    dropMarkerRef.current?.setPosition(drop);
    const g = window.google;
    if (mapRef.current && g) {
      const bounds = new g.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(drop);
      if (captain) bounds.extend(captain);
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [pickup, drop, captain]);

  // Update polyline
  useEffect(() => {
    const g = window.google;
    if (!mapRef.current || !g) return;
    polylineRef.current?.setMap(null);
    if (!polyline) return;

    const path = g.maps.geometry.encoding.decodePath(polyline);
    if (!path) return;
    polylineRef.current = new g.maps.Polyline({
      path,
      strokeColor: "#111827",
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: mapRef.current,
    });
  }, [polyline]);

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
