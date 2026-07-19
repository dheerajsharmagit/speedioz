// Loads the Google Maps JS API exactly once, browser-only.
// Uses the referrer-restricted browser key from the Google Maps connector.

export type LatLngLiteral = { lat: number; lng: number };
export type GoogleLatLng = { lat: () => number; lng: () => number };
export type GoogleMap = { fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void };
export type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  setPosition: (position: LatLngLiteral) => void;
};
export type GooglePolyline = { setMap: (map: GoogleMap | null) => void };
export type GoogleLatLngBounds = { extend: (point: LatLngLiteral | GoogleLatLng) => void };
export type GooglePlacesLibrary = {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: Record<string, unknown>) => Promise<{ suggestions?: unknown[] }>;
  };
};
export type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    Polyline: new (options: Record<string, unknown>) => GooglePolyline;
    LatLngBounds: new () => GoogleLatLngBounds;
    SymbolPath: { CIRCLE: unknown };
    geometry: { encoding: { decodePath: (encoded: string) => GoogleLatLng[] } };
    importLibrary: (library: "places" | string) => Promise<unknown>;
  };
};

let loaderPromise: Promise<GoogleMapsApi> | null = null;

declare global {
  interface Window {
    __rcInitGoogleMaps?: () => void;
    google?: GoogleMapsApi;
  }
}

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;

  const browserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const trackingId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!browserKey) {
    return Promise.reject(new Error("Google Maps browser key is missing"));
  }

  loaderPromise = new Promise((resolve, reject) => {
    window.__rcInitGoogleMaps = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialise"));
    };
    const script = document.createElement("script");
    const channel = trackingId ? `&channel=${encodeURIComponent(trackingId)}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}&loading=async&libraries=geometry,places&callback=__rcInitGoogleMaps${channel}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
