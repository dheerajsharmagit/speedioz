// Server functions that proxy Google Maps Routes API calls through the connector gateway.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const routeInput = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  travelMode: z.enum(["DRIVE", "TWO_WHEELER"]).default("TWO_WHEELER"),
});

type RouteResponse = {
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: Array<never>;
};

// This runs on the server-function runtime, so it does not expose a routing
// provider to the browser. OSRM's geometry is a standard encoded polyline and
// lets the Leaflet fallback show roads when Google Maps is not configured.
async function computeOsrmRoute(data: z.infer<typeof routeInput>): Promise<RouteResponse> {
  const url = `https://router.project-osrm.org/route/v1/driving/${data.origin.lng},${data.origin.lat};${data.destination.lng},${data.destination.lat}?overview=full&geometries=polyline`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Road route failed (${response.status})`);
  const payload = (await response.json()) as {
    routes?: Array<{ geometry?: string; distance?: number; duration?: number }>;
  };
  const route = payload.routes?.[0];
  if (!route?.geometry) throw new Error("No road route found");
  return {
    encodedPolyline: route.geometry,
    distanceMeters: Math.round(route.distance ?? 0),
    durationSeconds: Math.round(route.duration ?? 0),
    steps: [],
  };
}

export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => routeInput.parse(input))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) return computeOsrmRoute(data);

    const body = {
      origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
      destination: { location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } } },
      travelMode: data.travelMode,
      polylineEncoding: "ENCODED_POLYLINE",
    };

    const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.distanceMeters",
          "routes.polyline.encodedPolyline",
          "routes.legs.steps.navigationInstruction",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.endLocation",
          "routes.legs.steps.polyline.encodedPolyline",
        ].join(","),
      },
      body: JSON.stringify(body),
    });

    if (response.status === 403) {
      // A referrer-restricted or disabled Google key must not turn the map
      // into an aerial line. Use the server-side road-route fallback instead.
      return computeOsrmRoute(data);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Routes API failed [${response.status}]: ${errorBody}`);
      return computeOsrmRoute(data);
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{
          steps?: Array<{
            navigationInstruction?: { instructions?: string; maneuver?: string };
            distanceMeters?: number;
            endLocation?: { latLng?: { latitude?: number; longitude?: number } };
            polyline?: { encodedPolyline?: string };
          }>;
        }>;
      }>;
    };

    const route = payload.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return computeOsrmRoute(data);

    // duration is a Duration string like "1234s"
    const durationSeconds = route.duration ? parseInt(route.duration.replace(/[^0-9]/g, ""), 10) : 0;

    const steps = (route.legs ?? []).flatMap((leg) =>
      (leg.steps ?? []).map((s) => ({
        instruction: s.navigationInstruction?.instructions ?? "",
        maneuver: s.navigationInstruction?.maneuver ?? "",
        distanceMeters: s.distanceMeters ?? 0,
        endLat: s.endLocation?.latLng?.latitude ?? 0,
        endLng: s.endLocation?.latLng?.longitude ?? 0,
        encodedPolyline: s.polyline?.encodedPolyline ?? "",
      })),
    );

    return {
      encodedPolyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds,
      steps,
    };
  });
