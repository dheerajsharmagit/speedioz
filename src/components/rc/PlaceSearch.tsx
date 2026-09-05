import { useEffect, useRef, useState } from "react";
import { type GooglePlacesLibrary, loadGoogleMaps } from "@/lib/google-maps-loader";

export type PlaceResult = { name: string; addr: string; lat: number; lng: number };

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: PlaceResult) => void;
  placeholder?: string;
  bias?: { lat: number; lng: number } | null;
}

type Suggestion = {
  placeId: string;
  primary: string;
  secondary: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
};

export function PlaceSearch({ value, onChange, onSelect, placeholder, bias }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef<unknown>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      try {
        const g = await loadGoogleMaps();
        const places = (await g.maps.importLibrary("places")) as GooglePlacesLibrary;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new places.AutocompleteSessionToken();
        }
        const request: any = { input: value, sessionToken: sessionTokenRef.current };
        if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
          request.locationBias = { lat: bias.lat, lng: bias.lng };
        }
        const { suggestions: rawSuggestions } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        const mapped: Suggestion[] = (rawSuggestions ?? [])
          .map((s: any) => {
            const p = s.placePrediction;
            return {
              placeId: p?.placeId ?? "",
              primary: p?.mainText?.text ?? p?.text?.text ?? "",
              secondary: p?.secondaryText?.text ?? "",
              raw: p,
            };
          })
          .filter((s: Suggestion) => s.placeId);
        if (myReq !== reqIdRef.current) return;
        setSuggestions(mapped);
      } catch (e) {
        console.warn("autocomplete failed", e);
        if (myReq === reqIdRef.current) setSuggestions([]);
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, 400); // Increased debounce to be safer on slow networks
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, bias?.lat, bias?.lng]);

  async function handlePick(s: Suggestion) {
    try {
      const place = s.raw.toPlace();
      await place.fetchFields({ fields: ["location", "formattedAddress", "displayName"] });
      const loc = place.location;
      if (!loc) return;
      onSelect({
        name: place.displayName ?? s.primary,
        addr: place.formattedAddress ?? [s.primary, s.secondary].filter(Boolean).join(", "),
        lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
        lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
      });
      setSuggestions([]);
      sessionTokenRef.current = null; // new session next time
    } catch (e) {
      console.error("place fetch failed", e);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
              key={s.placeId}
              onClick={() => handlePick(s)}
              className="flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted"
            >
              <span className="text-sm font-bold">{s.primary}</span>
              {s.secondary && (
                <span className="text-xs text-muted-foreground">{s.secondary}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
