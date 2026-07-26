// Loads the Google Maps JS API exactly once, browser-only.
// Uses the referrer-restricted browser key from the Google Maps connector.

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
    geometry: { encoding: { decodePath: (encoded: string) => GoogleLatLng[] } };
    importLibrary: (library: "places" | string) => Promise<unknown>;
  };
};

let loaderPromise: Promise<GoogleMapsApi> | null = null;
let attemptCount = 0;
const MAX_ATTEMPTS = 3;

declare global {
  interface Window {
    __rcInitGoogleMaps?: () => void;
    google?: GoogleMapsApi;
    gm_authFailure?: () => void;
    __rcGmAuthFailed?: boolean;
  }
}


function attemptLoad(): Promise<GoogleMapsApi> {
  const browserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const trackingId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!browserKey) return Promise.reject(new Error("Google Maps browser key is missing"));

  return new Promise((resolve, reject) => {
    const timeoutMs = 12000;
    let done = false;
    window.gm_authFailure = () => {
      window.__rcGmAuthFailed = true;
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      reject(new Error("Google Maps authentication failed (referrer not allowed)"));
    };

    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("Google Maps load timed out"));
    }, timeoutMs);

    window.__rcInitGoogleMaps = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialise"));
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

export function resetGoogleMapsLoader(): void {
  loaderPromise = null;
  attemptCount = 0;
  if (typeof window !== "undefined") window.__rcGmAuthFailed = false;
}

const authFailureListeners = new Set<() => void>();
export function onGoogleMapsAuthFailure(cb: () => void): () => void {
  if (typeof window !== "undefined") {
    if (window.__rcGmAuthFailed) {
      cb();
      return () => {};
    }
    // (Re)install a hook that also notifies listeners.
    const prev = window.gm_authFailure;
    window.gm_authFailure = () => {
      window.__rcGmAuthFailed = true;
      prev?.();
      authFailureListeners.forEach((fn) => fn());
    };
  }
  authFailureListeners.add(cb);
  return () => authFailureListeners.delete(cb);
}


export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;

  loaderPromise = (async () => {
    let lastErr: unknown = null;
    while (attemptCount < MAX_ATTEMPTS) {
      attemptCount++;
      try {
        const g = await attemptLoad();
        return g;
      } catch (e) {
        lastErr = e;
        console.warn(`Google Maps load attempt ${attemptCount} failed`, e);
        if (attemptCount < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 800 * attemptCount));
        }
      }
    }
    loaderPromise = null; // allow future retry via reset
    throw lastErr instanceof Error ? lastErr : new Error("Google Maps failed to load");
  })();

  return loaderPromise;
}

