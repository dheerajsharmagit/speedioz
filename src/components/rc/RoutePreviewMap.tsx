import { useEffect, useRef, useState } from "react";
import {
  type GoogleMap,
  type GooglePolyline,
  type GoogleLatLng,
  loadGoogleMaps,
} from "@/lib/google-maps-loader";
import { useTheme } from "@/lib/theme";

interface Props {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  className?: string;
  encodedPolyline?: string;
}

export function RoutePreviewMap({ from, to, className, encodedPolyline }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState(false);
  const { markers } = useTheme();

  useEffect(() => {
    setError(false);
    let cancelled = false;
    let map: GoogleMap | null = null;
    let poly: GooglePolyline | null = null;

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
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: markers.pickupFill,
            fillOpacity: 1,
            strokeColor: markers.pickupStroke,
            strokeWeight: 1.5,
          },
        });
        new g.maps.Marker({
          position: to,
          map,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: markers.dropFill,
            fillOpacity: 1,
            strokeColor: markers.dropStroke,
            strokeWeight: 1.5,
          },
        });

        const encoded = encodedPolyline;

        if (encoded && map && !cancelled) {
          const path = g.maps.geometry.encoding.decodePath(encoded);
          poly = new g.maps.Polyline({
            path,
            strokeColor: markers.routeStroke,
            strokeOpacity: 0.9,
            strokeWeight: 3,
            map,
          });
          const bounds = new g.maps.LatLngBounds();
          path.forEach((p: GoogleLatLng) => bounds.extend(p));
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
  }, [from.lat, from.lng, to.lat, to.lng, markers, encodedPolyline]);

  if (error) {
    return (
      <div
        className={`${className ?? ""} grid place-items-center bg-muted text-[10px] font-mono uppercase text-muted-foreground`}
      >
        Map unavailable
      </div>
    );
  }
  return <div ref={containerRef} className={className ?? "h-32 w-full"} />;
}
