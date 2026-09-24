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

// Place suggestions come from OpenStreetMap (Nominatim), which needs no key.
// Browser Google Places is no longer authorised for this app's map key.
async function searchPlaces(q: string, bias?: { lat: number; lng: number } | null): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", limit: "8", countrycodes: "in" });
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    const d = 0.5;
    params.set("viewbox", `${bias.lng - d},${bias.lat + d},${bias.lng + d},${bias.lat - d}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Search failed [${res.status}]`);
  const rows: any[] = await res.json();
  return rows.map((r) => {
    const parts = String(r.display_name ?? "").split(",").map((s) => s.trim());
    return {
      id: String(r.place_id),
      primary: r.name || parts[0] || "",
      secondary: parts.slice(r.name ? 1 : 1).join(", "),
      lat: Number(r.lat),
      lng: Number(r.lon),
    };
  }).filter((s) => s.primary && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

export function PlaceSearch({ value, onChange, onSelect, placeholder, bias }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const reqIdRef = useRef(0);

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
        const list = await searchPlaces(value.trim(), bias);
        if (myReq !== reqIdRef.current) return;
        setSuggestions(list);
        setEmpty(list.length === 0);
      } catch (e) {
        console.warn("place search failed", e);
        if (myReq === reqIdRef.current) { setSuggestions([]); setEmpty(true); }
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value, picked, bias?.lat, bias?.lng]);

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
          value={value}
          onChange={(e) => { setPicked(null); onChange(e.target.value); }}
          placeholder={placeholder ?? "Search destination"}
          className="h-16 w-full rounded-2xl bg-muted pl-10 pr-4 text-lg font-semibold outline-none placeholder:text-muted-foreground"
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
        <p className="mt-2 px-2 text-xs text-muted-foreground">No places found. Try a nearby landmark or area name.</p>
      )}
    </div>
  );
}
