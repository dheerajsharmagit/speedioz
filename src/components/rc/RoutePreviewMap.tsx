import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { computeRoute } from "@/lib/routes.functions";

interface Props {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  className?: string;
}

const cache = new Map<string, string>();

export function RoutePreviewMap({ from, to, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: google.maps.Map | null = null;
    let poly: google.maps.Polyline | null = null;

    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;

        map = new g.maps.Map(containerRef.current, {
          center: from,
          zoom: 12,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
          draggable: false,
          clickableIcons: false,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text", stylers: [{ visibility: "off" }] },
          ],
        });

        new g.maps.Marker({
          position: from,
          map,
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 5, fillColor: "#FFD400", fillOpacity: 1, strokeColor: "#111827", strokeWeight: 1.5 },
        });
        new g.maps.Marker({
          position: to,
          map,
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 5, fillColor: "#111827", fillOpacity: 1, strokeColor: "#FFD400", strokeWeight: 1.5 },
        });

        const cacheKey = `${from.lat},${from.lng}->${to.lat},${to.lng}`;
        let encoded = cache.get(cacheKey);
        if (!encoded) {
          try {
            const res = await computeRoute({ data: { origin: from, destination: to, travelMode: "TWO_WHEELER" } });
            encoded = res.encodedPolyline;
            if (encoded) cache.set(cacheKey, encoded);
          } catch (e) {
            console.warn("route preview failed", e);
          }
        }

        if (encoded && map && !cancelled) {
          const path = g.maps.geometry.encoding.decodePath(encoded);
          poly = new g.maps.Polyline({
            path,
            strokeColor: "#111827",
            strokeOpacity: 0.9,
            strokeWeight: 3,
            map,
          });
          const bounds = new g.maps.LatLngBounds();
          path.forEach((p) => bounds.extend(p));
          map.fitBounds(bounds, 20);
        } else if (map) {
          const bounds = new g.maps.LatLngBounds();
          bounds.extend(from);
          bounds.extend(to);
          map.fitBounds(bounds, 20);
        }
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();

    return () => {
      cancelled = true;
      poly?.setMap(null);
      map = null;
    };
  }, [from.lat, from.lng, to.lat, to.lng]);

  if (error) {
    return <div className={`${className ?? ""} grid place-items-center bg-muted text-[10px] font-mono uppercase text-muted-foreground`}>Map unavailable</div>;
  }
  return <div ref={containerRef} className={className ?? "h-32 w-full"} />;
}
