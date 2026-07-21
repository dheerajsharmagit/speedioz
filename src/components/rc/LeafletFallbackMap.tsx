import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "@/lib/polyline";
import { useTheme } from "@/lib/theme";

type LatLng = { lat: number; lng: number };

interface Props {
  pickup: LatLng;
  drop: LatLng;
  captain?: LatLng | null;
  userLocation?: LatLng | null;
  polyline?: string;
  className?: string;
  fitKey?: string;
}

function dot(color: string, stroke: string, size = 16) {
  const html = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${stroke};box-shadow:0 1px 3px rgba(0,0,0,.25)"></div>`;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export function LeafletFallbackMap({ pickup, drop, captain, userLocation, polyline, className, fitKey }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupRef = useRef<L.Marker | null>(null);
  const dropRef = useRef<L.Marker | null>(null);
  const captainRef = useRef<L.Marker | null>(null);
  const userRef = useRef<L.Marker | null>(null);
  const polyRef = useRef<L.Polyline | null>(null);
  const { markers } = useTheme();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([pickup.lat, pickup.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pickupRef.current) pickupRef.current = L.marker([pickup.lat, pickup.lng], { icon: dot(markers.pickupFill, markers.pickupStroke) }).addTo(map);
    else pickupRef.current.setLatLng([pickup.lat, pickup.lng]).setIcon(dot(markers.pickupFill, markers.pickupStroke));

    if (!dropRef.current) dropRef.current = L.marker([drop.lat, drop.lng], { icon: dot(markers.dropFill, markers.dropStroke) }).addTo(map);
    else dropRef.current.setLatLng([drop.lat, drop.lng]).setIcon(dot(markers.dropFill, markers.dropStroke));

    if (captain) {
      if (!captainRef.current) captainRef.current = L.marker([captain.lat, captain.lng], { icon: dot(markers.captainFill, markers.captainStroke, 18) }).addTo(map);
      else captainRef.current.setLatLng([captain.lat, captain.lng]);
    } else if (captainRef.current) {
      captainRef.current.remove();
      captainRef.current = null;
    }

    if (userLocation) {
      if (!userRef.current) userRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: dot(markers.userFill, "#ffffff", 14) }).addTo(map);
      else userRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else if (userRef.current) {
      userRef.current.remove();
      userRef.current = null;
    }
  }, [pickup, drop, captain, userLocation, markers]);

  // Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    polyRef.current?.remove();
    polyRef.current = null;
    if (polyline) {
      const pts = decodePolyline(polyline).map((p) => [p.lat, p.lng] as [number, number]);
      if (pts.length > 1) {
        polyRef.current = L.polyline(pts, { color: markers.routeStroke, weight: 5, opacity: 0.95 }).addTo(map);
      }
    }
  }, [polyline, markers]);

  // Fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts: [number, number][] = [[pickup.lat, pickup.lng], [drop.lat, drop.lng]];
    if (captain) pts.push([captain.lat, captain.lng]);
    if (polyline) for (const p of decodePolyline(polyline)) pts.push([p.lat, p.lng]);
    if (pts.length >= 2 && (pickup.lat !== drop.lat || pickup.lng !== drop.lng)) {
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 40] });
    } else {
      map.setView([pickup.lat, pickup.lng], 15);
    }
  }, [pickup, drop, captain, polyline, fitKey]);

  return (
    <div className={className ?? "h-full w-full"} style={{ position: "relative" }}>
      <div ref={containerRef} className="absolute inset-0 bg-muted" />
      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-background/90 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground shadow-sm">
        Fallback map
      </div>
    </div>
  );
}
