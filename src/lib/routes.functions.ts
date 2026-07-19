// Server functions that proxy Google Maps Routes API calls through the connector gateway.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const routeInput = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  travelMode: z.enum(["DRIVE", "TWO_WHEELER"]).default("TWO_WHEELER"),
});

export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => routeInput.parse(input))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) {
      throw new Error("Google Maps connector is not configured");
    }

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
      const err = (await response.json().catch(() => null)) as { error?: { details?: Array<{ reason?: string }> } } | null;
      const reason = err?.error?.details?.find((d) => d.reason)?.reason;
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
        throw new Error("Google Maps server key is referrer-restricted. Set its application restrictions to 'None' or 'IP addresses' in Google Cloud Console.");
      }
      if (reason === "API_KEY_SERVICE_BLOCKED") {
        throw new Error("Google Maps server key does not allow the Routes API. Add it to the key's allowed-APIs list.");
      }
      throw new Error("Google Maps Routes request was denied (403).");
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Routes API failed [${response.status}]: ${errorBody}`);
      throw new Error(`Routes API failed (${response.status})`);
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
    if (!route?.polyline?.encodedPolyline) {
      return { encodedPolyline: "", distanceMeters: 0, durationSeconds: 0, steps: [] };
    }

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
