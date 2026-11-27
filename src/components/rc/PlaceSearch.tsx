import { useEffect, useRef, useState } from "react";

export type PlaceResult = { name: string; addr: string; lat: number; lng: number };

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: PlaceResult) => void;
  placeholder?: string;
  bias?: { lat: number; lng: number } | null;
}

type Suggestion = { id: string; primary: string; secondary: string; lat: number; lng: number };

// --- Google Places Autocomplete (primary) ---
async function googlePlacesSearch(
  q: string,
  bias?: { lat: number; lng: number } | null,
): Promise<Suggestion[]> {
  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey || typeof window === "undefined" || !window.google?.maps?.places) return [];

  return new Promise((resolve) => {
    const sessionToken = new window.google.maps.places.AutocompleteSessionToken();
    const request: Record<string, unknown> = {
      input: q,
      sessionToken,
      fields: ["place_id", "description", "structured_formatting", "location"],
    };
    if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
      request.location = new window.google.maps.LatLng(bias.lat, bias.lng);
      request.radius = 40000; // 40 km
      request.region = "in";
    }
    const service = new window.google.maps.places.AutocompleteService();
    service.getPlacePredictions(request, (predictions, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
        resolve([]);
        return;
      }
      const results: Suggestion[] = predictions.map((p) => {
        const main = p.structured_formatting?.main_text || p.description || "";
        const secondary = p.structured_formatting?.secondary_text || "";
        return {
          id: p.place_id,
          primary: main,
          secondary,
          lat: 0,
          lng: 0,
        };
      });
      // Resolve coordinates via Geocode
      if (bias && results.length > 0 && typeof window !== "undefined" && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        const coordsPromises = results.slice(0, 8).map((r) => {
          return new Promise<void>((res) => {
            geocoder.geocode({ placeId: r.id }, (geoResults, geoStatus) => {
              if (geoStatus === "OK" && geoResults?.[0]?.geometry?.location) {
                const loc = geoResults[0].geometry.location;
                r.lat = loc.lat();
                r.lng = loc.lng();
              }
              res();
            });
          });
        });
        Promise.all(coordsPromises).then(() => resolve(results));
      } else {
        resolve(results);
      }
    });
  });
}

// --- OpenStreetMap Nominatim fallback ---
async function osmSearch(
  q: string,
  bias?: { lat: number; lng: number } | null,
): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
    countrycodes: "in",
  });
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    const d = 0.5;
    params.set("viewbox", `${bias.lng - d},${bias.lat + d},${bias.lng + d},${bias.lat - d}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Search failed [${res.status}]`);
  const rows: any[] = await res.json();
  return rows
    .map((r) => {
      const parts = String(r.display_name ?? "")
        .split(",")
        .map((s) => s.trim());
      return {
        id: String(r.place_id),
        primary: r.name || parts[0] || "",
        secondary: parts.slice(r.name ? 1 : 1).join(", "),
        lat: Number(r.lat),
        lng: Number(r.lon),
      };
    })
    .filter((s) => s.primary && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

export function PlaceSearch({ value, onChange, onSelect, placeholder, bias }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const [gmReady, setGmReady] = useState(false);

  // Wait for Google Maps to load
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { loadGoogleMaps } = await import("@/lib/google-maps-loader");
        await loadGoogleMaps();
        if (!cancelled) setGmReady(true);
      } catch {
        // Google Maps not available — OSM fallback only
      }
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!value || value.trim().length < 2 || value === picked) {
      setSuggestions([]);
      setEmpty(false);
      return;
    }
    const t = setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      try {
        let list: Suggestion[] = [];
        if (gmReady) {
          list = await googlePlacesSearch(value.trim(), bias);
        }
        if (list.length === 0) {
          list = await osmSearch(value.trim(), bias);
        }
        if (myReq !== reqIdRef.current) return;
        setSuggestions(list);
        setEmpty(list.length === 0);
      } catch (e) {
        console.warn("place search failed", e);
        if (myReq === reqIdRef.current) {
          setSuggestions([]);
          setEmpty(true);
        }
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value, picked, bias?.lat, bias?.lng, gmReady]);

  function handlePick(s: Suggestion) {
    const addr = [s.primary, s.secondary].filter(Boolean).join(", ");
    setPicked(s.primary);
    setSuggestions([]);
    setEmpty(false);
    onSelect({ name: s.primary, addr, lat: s.lat, lng: s.lng });
  }

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
        <input
          aria-label={placeholder ?? "Search destination"}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setPicked(null);
            onChange(e.target.value);
          }}
          placeholder={placeholder ?? "Search destination"}
          className="h-14 w-full min-w-0 rounded-xl border border-border bg-muted/50 pl-10 pr-4 text-base font-medium outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase text-muted-foreground">
            …
          </span>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handlePick(s)}
              className="flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted"
            >
              <span className="text-sm font-bold">{s.primary}</span>
              {s.secondary && <span className="text-xs text-muted-foreground">{s.secondary}</span>}
            </button>
          ))}
        </div>
      )}
      {empty && !loading && (
        <p className="mt-2 px-2 text-xs text-muted-foreground">
          No places found. Try a nearby landmark or area name.
        </p>
      )}
    </div>
  );
}
