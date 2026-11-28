// Loads the Google Maps JS API exactly once, browser-only.
// Uses a referrer-restricted browser key.

export type LatLngLiteral = { lat: number; lng: number };
export type GoogleLatLng = { lat: () => number; lng: () => number };
export type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
  panTo: (position: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
};
export type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  setPosition: (position: LatLngLiteral) => void;
  setIcon: (icon: Record<string, unknown>) => void;
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
    Size: new (width: number, height: number) => { width: number; height: number };
    Point: new (x: number, y: number) => { x: number; y: number };
    geometry: { encoding: { decodePath: (encoded: string) => GoogleLatLng[] } };
    importLibrary: (library: "places" | string) => Promise<unknown>;
  };
};

let loaderPromise: Promise<GoogleMapsApi> | null = null;
const MAX_ATTEMPTS = 3;
let authFailed = false;
const authFailureListeners = new Set<() => void>();

declare global {
  interface Window {
    __rcInitGoogleMaps?: () => void;
    google?: GoogleMapsApi;
    gm_authFailure?: () => void;
  }
}


function attemptLoad(browserKey: string): Promise<GoogleMapsApi> {
  const trackingId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

  return new Promise((resolve, reject) => {
    const timeoutMs = 12000;
    let done = false;
    window.gm_authFailure = () => {
      if (authFailed) return;
      authFailed = true;
      authFailureListeners.forEach((listener) => listener());
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Google Maps authentication failed"));
    };

    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      script.remove();
      reject(new Error("Google Maps load timed out"));
    }, timeoutMs);

    window.__rcInitGoogleMaps = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (window.google?.maps?.Map) resolve(window.google);
      else {
        script.remove();
        reject(new Error("Google Maps failed to initialise"));
      }
    };
    const script = document.createElement("script");
    const channel = trackingId ? `&channel=${encodeURIComponent(trackingId)}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}&loading=async&libraries=geometry,places&callback=__rcInitGoogleMaps${channel}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Google Maps script failed to load"));
    };
    document.head.appendChild(script);
  });
}

export function onGoogleMapsAuthFailure(cb: () => void): () => void {
  if (authFailed) cb();
  authFailureListeners.add(cb);
  return () => authFailureListeners.delete(cb);
}


export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (authFailed) return Promise.reject(new Error("Google Maps authentication failed"));
  if (loaderPromise) return loaderPromise;
  const browserKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY?.trim()
    || import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY?.trim();
  if (!browserKey) return Promise.reject(new Error("Google Maps browser key is missing"));

  loaderPromise = (async () => {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !authFailed; attempt++) {
      try {
        const g = await attemptLoad(browserKey);
        return g;
      } catch (e) {
        lastErr = e;
        console.warn(`Google Maps load attempt ${attempt} failed`, e);
        if (authFailed) break;
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
    }
    loaderPromise = null;
    if (authFailed) throw new Error("Google Maps authentication failed");
    throw lastErr instanceof Error ? lastErr : new Error("Google Maps failed to load");
  })();

  return loaderPromise;
}

