// Loads the Google Maps JS API exactly once, browser-only.
// Uses the referrer-restricted browser key from the Google Maps connector.

let loaderPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    __rcInitGoogleMaps?: () => void;
    google?: typeof google;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
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
