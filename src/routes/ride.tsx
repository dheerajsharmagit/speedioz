import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoleNav } from "@/components/rc/RoleNav";
import { RideMap } from "@/components/rc/RideMap";
import { PlaceSearch, type PlaceResult } from "@/components/rc/PlaceSearch";
import { storage, rideApi } from "@/lib/api";
import { computeRoute } from "@/lib/routes.functions";
import { getDeviceId } from "@/lib/device-id";
import { decodePolyline, pointAt } from "@/lib/polyline";
import { generateOtp, type Ride, type RideStatus } from "@/lib/rides";
import { io, Socket } from "socket.io-client";

export const Route = createFileRoute("/ride")({
  head: () => ({
    meta: [
      { title: "Book a ride — RIDEHER" },
      { name: "description", content: "Bike, auto, and EV rides with community-verified smart routes." },
    ],
  }),
  component: RidePage,
});

type Vehicle = { id: string; name: string; price: number; eta: string; note?: string };
const vehicles: Vehicle[] = [
  { id: "bike", name: "Bike", price: 45, eta: "3 min" },
  { id: "auto", name: "Auto", price: 78, eta: "6 min" },
  { id: "ev", name: "EV Bike", price: 52, eta: "4 min", note: "Green" },
];

type Pickup = { label: string; lat: number; lng: number };
type RouteStep = {
  instruction: string;
  maneuver: string;
  distanceMeters: number;
  endLat: number;
  endLng: number;
  encodedPolyline: string;
};
// Fallback pickup used until browser geolocation resolves (Bangalore center).
const DEFAULT_PICKUP: Pickup = { label: "Locating you…", lat: 12.9718, lng: 77.6412 };

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function maneuverGlyph(m: string): string {
  const k = (m || "").toUpperCase();
  if (k.includes("LEFT")) return "↰";
  if (k.includes("RIGHT")) return "↱";
  if (k.includes("UTURN")) return "⤴";
  if (k.includes("MERGE")) return "⇱";
  if (k.includes("ROUNDABOUT")) return "⟳";
  if (k.includes("DESTINATION")) return "◉";
  return "↑";
}

function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

function formatDuration(sec: number): string {
  if (!sec || sec < 60) return `${Math.max(1, Math.round(sec / 60))} min`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m} min` : `${h}h`;
}

// Reverse-geocode a lat/lng to a human address using OpenStreetMap Nominatim.
// Free, no key required. Falls back silently on failure.
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    if (j.address) {
      const a = j.address;
      const parts = [
        a.road || a.pedestrian || a.neighbourhood || a.suburb,
        a.suburb && a.road ? a.suburb : null,
        a.city || a.town || a.village,
      ].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
    return j.display_name ?? null;
  } catch {
    return null;
  }
}

// Return index of the step whose endLocation is the next waypoint ahead of `pos`.
function activeStepIndex(steps: RouteStep[], pos: { lat: number; lng: number }): number {
  if (steps.length === 0) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const d = haversineKm(pos, { lat: steps[i].endLat, lng: steps[i].endLng });
    if (d < bestD) { bestD = d; best = i; }
  }
  // If we're already within 30m of this step's end, advance to the next.
  if (bestD * 1000 < 30 && best < steps.length - 1) return best + 1;
  return best;
}


type UiStep =
  | "destination"
  | "vehicle"
  | "confirm"
  | "searching"
  | "matched"
  | "arriving"
  | "inprogress"
  | "completed"
  | "rating";

type Payment = "upi" | "cash" | "card";

function stepFromStatus(status: RideStatus): UiStep {
  switch (status) {
    case "searching": return "searching";
    case "accepted": return "matched";
    case "arriving": return "arriving";
    case "in_progress": return "inprogress";
    case "completed": return "completed";
    case "rated": return "rating";
    case "rating": return "rating";
    default: return "searching";
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function computeEtaMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  vehicle: string,
): number {
  const km = haversineKm(from, to);
  const avgKmh = vehicle === "auto" ? 22 : 28; // rough urban avg
  const minutes = Math.round((km / avgKmh) * 60);
  return Math.max(1, minutes);
}



function RidePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<UiStep>("destination");
  const [selected, setSelected] = useState("bike");
  const [pickup, setPickup] = useState<Pickup>(DEFAULT_PICKUP);
  const [pickupQuery, setPickupQuery] = useState("");
  const [locating, setLocating] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<null | "denied" | "unavailable" | "timeout">(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [destQuery, setDestQuery] = useState("");
  const [dest, setDest] = useState<PlaceResult | null>(null);
  const [payment, setPayment] = useState<Payment>("upi");
  const [useSmartRoute, setUseSmartRoute] = useState(true);
  const [ride, setRide] = useState<Ride | null>(null);
  const [encodedPolyline, setEncodedPolyline] = useState<string>("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [approachPolyline, setApproachPolyline] = useState<string>("");
  const [captainPos, setCaptainPos] = useState<{ lat: number; lng: number } | null>(null);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [creating, setCreating] = useState(false);
  const deviceIdRef = useRef<string>("");
  const userIdRef = useRef<string>("");
  const approachFetchedRef = useRef<string | null>(null);
  const firstFixRef = useRef(false);

  const [routeInfo, setRouteInfo] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);

  function requestGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("unavailable");
      setLocating(false);
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(p);
        setPickup({ label: "Current location", ...p });
        firstFixRef.current = true;
        setLocating(false);
        reverseGeocode(p.lat, p.lng).then((addr) => {
          if (addr) setPickup((prev) => (prev.lat === p.lat && prev.lng === p.lng ? { ...prev, label: addr } : prev));
        });
      },
      (err) => {
        const code = err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "timeout";
        setGeoError(code);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    deviceIdRef.current = getDeviceId();
    const user = storage.getUser();
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    userIdRef.current = user.id;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("unavailable");
      setLocating(false);
      return;
    }

    requestGeolocation();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(p);
        setGeoError(null);
        if (!firstFixRef.current) {
          setPickup({ label: "Current location", ...p });
          firstFixRef.current = true;
          setLocating(false);
          reverseGeocode(p.lat, p.lng).then((addr) => {
            if (addr) setPickup((prev) => (prev.lat === p.lat && prev.lng === p.lng ? { ...prev, label: addr } : prev));
          });
        }
      },
      (err) => {
        const code = err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "timeout";
        setGeoError(code);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    return () => { navigator.geolocation.clearWatch(watchId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vehicle = useMemo(() => vehicles.find((v) => v.id === selected)!, [selected]);
  const fare = vehicle.price + (useSmartRoute ? 0 : 8);
  const smartSavings = 12;

  // Real-time ride updates via Socket.IO
  useEffect(() => {
    if (!ride?.id) return;

    const token = storage.getAccessToken();
    const socket = io("https://api.rideher.in", {
      auth: { token: `Bearer ${token}` },
      transports: ["websocket"]
    });

    socket.on("connect", () => {
      console.log("Socket connected, joining ride:", ride.id);
      socket.emit("join-ride", ride.id);
    });

    const handleUpdate = (updatedRide: any) => {
      console.log("Ride update received:", updatedRide);
      setRide(updatedRide);
      setStep(stepFromStatus(updatedRide.status as RideStatus));
      
      if (updatedRide.captain_lat && updatedRide.captain_lng) {
        setCaptainPos({ lat: updatedRide.captain_lat, lng: updatedRide.captain_lng });
      }
    };

    socket.on("ride.created", handleUpdate);
    socket.on("ride.assigned", handleUpdate);
    socket.on("ride.accepted", handleUpdate);
    socket.on("ride.rejected", handleUpdate);
    socket.on("ride.arriving", handleUpdate);
    socket.on("ride.arrived", handleUpdate);
    socket.on("ride.started", handleUpdate);
    socket.on("ride.completed", handleUpdate);
    socket.on("ride.cancelled", handleUpdate);

    // Also listen for captain location updates
    socket.on("captain.location", (loc: { lat: number; lng: number }) => {
      setCaptainPos(loc);
    });

    return () => {
      socket.disconnect();
    };
  }, [ride?.id]);

  // Fetch captain -> pickup route once we have a captain position (matching/pickup phase)
  useEffect(() => {
    if (!ride || !captainPos) return;
    if (ride.status !== "accepted" && ride.status !== "arriving") return;
    if (approachFetchedRef.current === ride.id) return;
    approachFetchedRef.current = ride.id;
    (async () => {
      try {
        const res = await computeRoute({
          data: {
            origin: { lat: captainPos.lat, lng: captainPos.lng },
            destination: { lat: ride.pickup_lat, lng: ride.pickup_lng },
            travelMode: ride.vehicle_type === "auto" ? "DRIVE" : "TWO_WHEELER",
          },
        });
        setApproachPolyline(res.encodedPolyline);
      } catch (e) {
        console.warn("approach route failed", e);
      }
    })();
  }, [ride?.id, ride?.status, captainPos]);


  // Compute polyline when destination is picked
  useEffect(() => {
    if (!dest) {
      setEncodedPolyline("");
      setRouteSteps([]);
      setRouteError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setRouteLoading(true);
      setRouteError(null);
      try {
        const res = await computeRoute({
          data: {
            origin: { lat: pickup.lat, lng: pickup.lng },
            destination: { lat: dest.lat, lng: dest.lng },
            travelMode: selected === "auto" ? "DRIVE" : "TWO_WHEELER",
          },
        });
        if (!cancelled) {
          if (!res.encodedPolyline) {
            setRouteError("No route found between these points.");
          }
          setEncodedPolyline(res.encodedPolyline || "");
          setRouteSteps(res.steps ?? []);
          setRouteInfo({ distanceMeters: res.distanceMeters ?? 0, durationSeconds: res.durationSeconds ?? 0 });
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("route fetch failed", e);
          // Fallback to simple straight line if API fails
          setRouteError(null);
          setEncodedPolyline(""); 
          setRouteSteps([]);
          setRouteInfo({ distanceMeters: haversineKm(pickup, dest) * 1000, durationSeconds: (haversineKm(pickup, dest) / 25) * 3600 });
        }
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dest?.lat, dest?.lng, pickup.lat, pickup.lng, selected]);

  async function createRide() {
    if (!dest) return;
    setCreating(true);
    try {
      const data = await rideApi.create({
        pickup_label: pickup.label,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        drop_label: dest.addr,
        drop_lat: dest.lat,
        drop_lng: dest.lng,
        vehicle_type: selected,
        fare_inr: fare,
        use_smart_route: useSmartRoute,
        payment_method: payment,
      });
      setRide(data as Ride);
      setStep("searching");
    } catch (e: any) {
      console.error(e);
      alert(e.error?.message || "Couldn't create ride. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function cancelSearch() {
    if (ride) {
      await rideApi.updateStatus(ride.id, "cancelled");
    }
    setRide(null);
    setEncodedPolyline("");
    setRouteSteps([]);
    setApproachPolyline("");
    approachFetchedRef.current = null;
    setCaptainPos(null);
    setStep("confirm");
  }

  async function submitRating() {
    if (!ride) return;
    await rideApi.rate(ride.id, { rating, tip_inr: tip });
    // reset
    setRide(null);
    setDest(null);
    setDestQuery("");
    setEncodedPolyline("");
    setApproachPolyline("");
    setRouteSteps([]);
    approachFetchedRef.current = null;
    setCaptainPos(null);
    setRating(0);
    setTip(0);
    setSelected("bike");
    setStep("destination");
  }

  const mapPickup = { lat: pickup.lat, lng: pickup.lng };
  const mapDrop = dest ? { lat: dest.lat, lng: dest.lng } : { lat: pickup.lat + 0.03, lng: pickup.lng + 0.03 };

  // Which polyline to draw: captain approach during matching/pickup, main route otherwise.
  const activePolyline =
    (step === "matched" || step === "arriving") && approachPolyline ? approachPolyline : encodedPolyline;

  // Live ETA (in minutes) — haversine distance / assumed average speed.
  const etaTarget =
    step === "matched" || step === "arriving"
      ? mapPickup
      : step === "inprogress"
        ? mapDrop
        : null;
  const etaMinutes = captainPos && etaTarget ? computeEtaMinutes(captainPos, etaTarget, selected) : null;
  const etaLabel =
    step === "matched" || step === "arriving"
      ? "Captain arriving in"
      : step === "inprogress"
        ? "Drop in"
        : null;

  // Turn-by-turn: pick active step based on captain position along the main route.
  const showTurnByTurn = step === "inprogress" && routeSteps.length > 0 && captainPos !== null;
  const activeStepIdx = showTurnByTurn ? activeStepIndex(routeSteps, captainPos!) : -1;
  const currentStep = activeStepIdx >= 0 ? routeSteps[activeStepIdx] : null;
  const nextStep = activeStepIdx >= 0 && activeStepIdx + 1 < routeSteps.length ? routeSteps[activeStepIdx + 1] : null;
  const distanceToTurn = currentStep && captainPos
    ? haversineKm(captainPos, { lat: currentStep.endLat, lng: currentStep.endLng }) * 1000
    : 0;

  // Overall trip progress (0..1) — how far captain has gone along main route.
  const tripProgress = (() => {
    if (step !== "inprogress" || !captainPos || routeSteps.length === 0) return 0;
    const total = routeSteps.reduce((s, x) => s + x.distanceMeters, 0);
    if (total === 0) return 0;
    const passed = routeSteps.slice(0, activeStepIdx).reduce((s, x) => s + x.distanceMeters, 0);
    return Math.min(1, Math.max(0, passed / total));
  })();

  // Live distance remaining — captain→pickup during pickup phase, captain→drop along route during trip.
  const distanceRemainingM = (() => {
    if ((step === "matched" || step === "arriving") && captainPos) {
      return haversineKm(captainPos, mapPickup) * 1000;
    }
    if (step === "inprogress" && captainPos && routeSteps.length > 0 && activeStepIdx >= 0) {
      const remainSteps = routeSteps
        .slice(activeStepIdx + 1)
        .reduce((s, x) => s + x.distanceMeters, 0);
      return distanceToTurn + remainSteps;
    }
    if (step === "inprogress" && captainPos) {
      return haversineKm(captainPos, mapDrop) * 1000;
    }
    return null;
  })();



  return (
    <div className="min-h-screen bg-background text-foreground">
      <RoleNav />
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col border-x border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          <div className="hidden">'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                                        
                                            
                                            IMPORTANT: CODE IMPLEMENTATION TASK — DO NOT ADD THIS AS UI TEXT.

Update the Customer/Rider app to use the real location-based booking flow.

Implement:

- Detect customer pickup location using GPS.

- Allow customer to search/select pickup and drop locations.

- Send accurate latitude/longitude to the backend when booking.

- Create the ride using the real booking API.

- Show "Finding nearest captain" while dispatch is running.

- Show captain details only after a captain accepts.

- Receive real-time Socket.IO updates for:

  ride.created

  ride.assigned

  ride.accepted

  ride.rejected

  ride.arriving

  ride.arrived

  ride.started

  ride.completed

  ride.cancelled

- If a captain rejects/expires, continue showing the customer that another nearby captain is being searched.

- Once a captain accepts, stop searching and display the assigned captain.

- Show accurate pickup/drop, fare, ETA and ride status from the backend.

Remove mock captain matching and fake ride progression.

The backend must remain the authority for captain selection and assignment.

Actually modify the existing code and test the complete booking flow.</div>
          {step === "destination" ? (
            <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
              RIDE<span className="text-primary">HER</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                if (step === "vehicle") setStep("destination");
                else if (step === "confirm") setStep("vehicle");
                else if (step === "searching") cancelSearch();
              }}
              disabled={step !== "vehicle" && step !== "confirm" && step !== "searching"}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-sm disabled:opacity-40"
              aria-label="Back"
            >
              ←
            </button>
          )}
          <StepIndicator step={step} />
        </div>

        {/* Map area */}
        <div className="relative min-h-[360px] flex-1 overflow-hidden">
          <RideMap
            pickup={mapPickup}
            drop={dest ? mapDrop : mapPickup}
            captain={captainPos}
            userLocation={userLocation}
            polyline={dest ? activePolyline : ""}
            routeLoading={routeLoading}
            routeError={routeError}
            fitKey={step}
            recenterKey={recenterKey}
            recenterTarget={userLocation ?? mapPickup}
            className="absolute inset-0"
          />

          {/* Recenter button */}
          <button
            type="button"
            onClick={() => {
              if (userLocation) {
                setRecenterKey((k) => k + 1);
              } else {
                requestGeolocation();
              }
            }}
            aria-label="Recenter map on my location"
            className="absolute right-4 top-24 grid h-11 w-11 place-items-center rounded-full bg-card text-secondary shadow-lg ring-1 ring-black/10 transition hover:scale-105 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>

          {/* Geolocation error banner — compact, top-anchored so it doesn't cover the map */}
          {geoError && (
            <div className="absolute inset-x-4 top-4 flex items-center gap-2 rounded-full bg-secondary/95 px-3 py-2 text-secondary-foreground shadow-lg ring-1 ring-black/10 backdrop-blur">
              <span className="text-xs font-semibold truncate">
                {geoError === "denied" ? "Location off — set pickup manually" : geoError === "timeout" ? "Location timed out" : "Location unavailable"}
              </span>
              <button
                onClick={requestGeolocation}
                className="ml-auto shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-secondary"
              >
                Retry
              </button>
              <button
                onClick={() => setGeoError(null)}
                aria-label="Dismiss"
                className="shrink-0 rounded-full border border-white/20 px-2 py-1 text-[11px] font-bold"
              >
                ✕
              </button>
            </div>
          )}





          <div className="pointer-events-none absolute left-6 right-6 top-6">
            {showTurnByTurn && currentStep ? (
              <div className="rounded-2xl bg-secondary/95 p-4 text-secondary-foreground shadow-lg ring-1 ring-black/10 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-black text-secondary">
                    {maneuverGlyph(currentStep.maneuver)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9px] uppercase tracking-widest opacity-60">
                      In {formatMeters(distanceToTurn)}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold">{stripHtml(currentStep.instruction) || "Continue"}</p>
                  </div>
                </div>
                {nextStep && (
                  <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-wider opacity-60">
                    Then · {stripHtml(nextStep.instruction)}
                  </p>
                )}
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.round(tripProgress * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-card/95 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">Pickup from</p>
                <p className="mt-1 text-xs font-semibold">{locating ? "Locating you…" : pickup.label}</p>
                {dest && (
                  <>
                    <div className="my-2 h-px bg-border" />
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Drop</p>
                    <p className="mt-1 text-xs font-semibold">{dest.addr}</p>
                  </>
                )}
                {dest && routeInfo && routeInfo.distanceMeters > 0 && (
                  <>
                    <div className="my-2 h-px bg-border" />
                    <div className="flex items-center gap-3 text-[11px] font-semibold">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        {formatMeters(routeInfo.distanceMeters)}
                      </span>
                      <span className="rounded-full bg-secondary/10 px-2 py-0.5">
                        ~{formatDuration(routeInfo.durationSeconds)}
                      </span>
                      <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                        via {selected === "auto" ? "roads" : "fastest"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>


          {etaLabel && etaMinutes !== null && (
            <div className="pointer-events-none absolute inset-x-6 bottom-4 flex justify-center">
              <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-secondary-foreground shadow-lg ring-1 ring-black/5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">{etaLabel}</span>
                <span className="text-sm font-extrabold">{etaMinutes} min</span>
                {distanceRemainingM !== null && (
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">
                    · {formatMeters(distanceRemainingM)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>



        {/* Bottom sheet */}
        <section className="animate-sheet-up relative -mt-8 rounded-t-[32px] bg-card pt-4 shadow-[0_-20px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-muted" />

          {step === "destination" && (
            <DestinationStep
              pickup={pickup}
              setPickup={(p) => { setPickup(p); setPickupQuery(p.label); }}
              pickupQuery={pickupQuery}
              setPickupQuery={setPickupQuery}
              useCurrentLocation={() => {
                if (typeof navigator === "undefined" || !navigator.geolocation) return;
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setPickup({ label: "Current location", lat, lng });
                    setPickupQuery("");
                    setLocating(false);
                    reverseGeocode(lat, lng).then((addr) => {
                      if (addr) setPickup((prev) => (prev.lat === lat && prev.lng === lng ? { ...prev, label: addr } : prev));
                    });
                  },
                  () => setLocating(false),
                  { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
                );
              }}
              locating={locating}
              dest={dest}
              setDest={setDest}
              query={destQuery}
              setQuery={setDestQuery}
              onNext={() => dest && setStep("vehicle")}
              routeInfo={routeInfo}
            />

          )}

          {step === "vehicle" && (
            <VehicleStep
              selected={selected}
              setSelected={setSelected}
              useSmartRoute={useSmartRoute}
              setUseSmartRoute={setUseSmartRoute}
              onNext={() => setStep("confirm")}
            />
          )}

          {step === "confirm" && (
            <ConfirmStep
              vehicle={vehicle}
              fare={fare}
              useSmartRoute={useSmartRoute}
              smartSavings={smartSavings}
              payment={payment}
              setPayment={setPayment}
              onNext={createRide}
              busy={creating}
              routeInfo={routeInfo}
              pickupLabel={pickup.label}
              dropLabel={dest?.addr ?? ""}
            />

          )}

          {step === "searching" && <SearchingStep onCancel={cancelSearch} />}

          {step === "matched" && ride && <MatchedStep ride={ride} />}

          {step === "arriving" && ride && (
            <RideStatusStep
              title="Captain arriving"
              subtitle={`${etaMinutes ?? "—"} min · ${
                distanceRemainingM !== null ? formatMeters(distanceRemainingM) : "—"
              } to pickup${ride.captain_name ? ` · ${ride.captain_name}` : ""}`}
              ride={ride}
              onNext={simulateArrivalAtPickup}
              ctaLabel="Simulate pickup"
            />
          )}

          {step === "inprogress" && ride && (
            <RideStatusStep
              title="On the way"
              subtitle={`${etaMinutes ?? "—"} min · ${
                distanceRemainingM !== null ? formatMeters(distanceRemainingM) : "—"
              } to drop · ${Math.round(tripProgress * 100)}% complete${
                useSmartRoute ? " · saving 12 min" : ""
              }`}
              ride={ride}
              onNext={simulateCompleted}
              ctaLabel="Simulate arrival"
            />
          )}

          {step === "completed" && ride && (
            <CompletedStep fare={ride.fare_inr} onNext={() => setStep("rating")} />
          )}

          {step === "rating" && ride && (
            <RatingStep
              captainName={ride.captain_name ?? "your captain"}
              rating={rating}
              setRating={setRating}
              tip={tip}
              setTip={setTip}
              onDone={submitRating}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- Step indicator ---------- */
function StepIndicator({ step }: { step: UiStep }) {
  const map: Record<UiStep, string> = {
    destination: "01 · Where to",
    vehicle: "02 · Vehicle",
    confirm: "03 · Confirm",
    searching: "04 · Matching",
    matched: "05 · Matched",
    arriving: "06 · Pickup",
    inprogress: "07 · En route",
    completed: "08 · Arrived",
    rating: "09 · Rate",
  };
  return (
    <span className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider">
      {map[step]}
    </span>
  );
}

/* ---------- Destination ---------- */
function DestinationStep({
  pickup,
  setPickup,
  pickupQuery,
  setPickupQuery,
  useCurrentLocation,
  locating,
  dest,
  setDest,
  query,
  setQuery,
  onNext,
  routeInfo,
}: {
  pickup: Pickup;
  setPickup: (p: Pickup) => void;
  pickupQuery: string;
  setPickupQuery: (v: string) => void;
  useCurrentLocation: () => void;
  locating: boolean;
  dest: PlaceResult | null;
  setDest: (v: PlaceResult | null) => void;
  query: string;
  setQuery: (v: string) => void;
  onNext: () => void;
  routeInfo: { distanceMeters: number; durationSeconds: number } | null;
}) {
  const [editPickup, setEditPickup] = useState(false);
  return (
    <>
      <div className="mb-3 px-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Pickup
          </p>
          <button
            onClick={() => setEditPickup((v) => !v)}
            className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
          >
            {editPickup ? "Cancel" : "Change"}
          </button>
        </div>
        {!editPickup ? (
          <div className="mt-1 flex items-center gap-2 rounded-2xl bg-muted px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="flex-1 truncate text-sm font-semibold">
              {locating ? "Locating you…" : pickup.label}
            </span>
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            <PlaceSearch
              value={pickupQuery}
              onChange={setPickupQuery}
              onSelect={(p) => {
                setPickup({ label: p.addr, lat: p.lat, lng: p.lng });
                setPickupQuery(p.addr);
                setEditPickup(false);
              }}
              placeholder="Search pickup location"
              bias={{ lat: pickup.lat, lng: pickup.lng }}
            />
            <button
              onClick={() => { useCurrentLocation(); setEditPickup(false); }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background text-xs font-bold"
            >
              <span className="h-2 w-2 rounded-full bg-primary" /> Use current location
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 px-6">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Drop
        </p>
        <PlaceSearch
          value={query}
          onChange={(v) => {
            setQuery(v);
            if (dest && v !== dest.addr) setDest(null);
          }}
          onSelect={(p) => {
            setDest(p);
            setQuery(p.addr);
          }}
          placeholder="Search a destination"
          bias={{ lat: pickup.lat, lng: pickup.lng }}
        />
      </div>

      {dest && routeInfo && routeInfo.distanceMeters > 0 && (
        <div className="mb-4 px-6">
          <div className="flex items-stretch gap-2 rounded-2xl border border-border bg-muted/40 p-3">
            <div className="flex-1 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Distance</p>
              <p className="mt-1 text-base font-extrabold">{formatMeters(routeInfo.distanceMeters)}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Est. time</p>
              <p className="mt-1 text-base font-extrabold">{formatDuration(routeInfo.durationSeconds)}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Route</p>
              <p className="mt-1 text-[11px] font-bold">Fastest path</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 pb-12">
        <button
          disabled={!dest}
          onClick={onNext}
          className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </>
  );
}


/* ---------- Vehicle ---------- */
function VehicleStep({
  selected, setSelected, useSmartRoute, setUseSmartRoute, onNext,
}: {
  selected: string;
  setSelected: (v: string) => void;
  useSmartRoute: boolean;
  setUseSmartRoute: (v: boolean) => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="mb-4 px-6">
        <h2 className="text-2xl font-extrabold tracking-tight">Pick your ride</h2>
        <p className="mt-1 text-xs text-muted-foreground">Fares include Smart Route savings.</p>
      </div>

      <div className="mb-6 flex gap-3 overflow-x-auto px-6 scrollbar-hide">
        {vehicles.map((v) => {
          const active = v.id === selected;
          return (
            <button
              key={v.id}
              onClick={() => setSelected(v.id)}
              className={`w-32 flex-none rounded-2xl p-4 text-left ring-1 transition ${
                active ? "bg-primary ring-black/5" : "bg-card ring-border hover:ring-foreground/20"
              }`}
            >
              <p className="font-mono text-[10px] font-bold uppercase">
                {v.name}
                {v.note ? <span className="ml-1 text-accent">·{v.note}</span> : null}
              </p>
              <p className={`mt-4 text-2xl font-extrabold ${active ? "" : v.id === "ev" ? "text-accent" : ""}`}>
                ₹{v.price}
              </p>
              <p className={`mt-1 text-[10px] font-semibold ${active ? "opacity-70" : "text-muted-foreground"}`}>
                {v.eta.toUpperCase()} ETA
              </p>
            </button>
          );
        })}
      </div>

      <div className="mb-6 px-6">
        <button
          onClick={() => setUseSmartRoute(!useSmartRoute)}
          className={`relative w-full overflow-hidden rounded-3xl p-6 text-left transition ${
            useSmartRoute ? "bg-secondary text-secondary-foreground" : "bg-muted"
          }`}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <span className={`mb-2 inline-block rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
                useSmartRoute ? "bg-accent/20 text-accent" : "bg-background text-muted-foreground"
              }`}>
                Community Route
              </span>
              <h3 className="text-xl font-bold leading-tight">Save 12 min</h3>
              <p className={`mt-1 text-xs ${useSmartRoute ? "text-secondary-foreground/60" : "text-muted-foreground"}`}>
                Verified by 47 captains this week
              </p>
            </div>
            <div className={`grid h-6 w-10 place-items-center rounded-full transition ${
              useSmartRoute ? "bg-accent" : "bg-background"
            }`}>
              <div className={`h-4 w-4 rounded-full bg-background transition-transform ${
                useSmartRoute ? "translate-x-2" : "-translate-x-2"
              }`} />
            </div>
          </div>
        </button>
      </div>

      <div className="px-6 pb-12">
        <button
          onClick={onNext}
          className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95"
        >
          Review ride
        </button>
      </div>
    </>
  );
}

/* ---------- Confirm ---------- */
function ConfirmStep({
  vehicle, fare, useSmartRoute, smartSavings, payment, setPayment, onNext, busy, routeInfo, pickupLabel, dropLabel,
}: {
  vehicle: Vehicle;
  fare: number;
  useSmartRoute: boolean;
  smartSavings: number;
  payment: Payment;
  setPayment: (p: Payment) => void;
  onNext: () => void;
  busy: boolean;
  routeInfo: { distanceMeters: number; durationSeconds: number } | null;
  pickupLabel: string;
  dropLabel: string;
}) {
  const methods: { id: Payment; label: string; sub: string }[] = [
    { id: "upi", label: "UPI", sub: "rider@okhdfc" },
    { id: "cash", label: "Cash", sub: "Pay on arrival" },
    { id: "card", label: "Card", sub: "•••• 4421" },
  ];
  return (
    <>
      <div className="mb-4 px-6">
        <h2 className="text-2xl font-extrabold tracking-tight">Confirm ride</h2>
      </div>

      <div className="mb-4 px-6">
        <div className="rounded-2xl border border-border p-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Pickup</p>
                <p className="truncate text-xs font-semibold">{pickupLabel}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Drop</p>
                <p className="truncate text-xs font-semibold">{dropLabel}</p>
              </div>
            </div>
          </div>
          {routeInfo && routeInfo.distanceMeters > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-[11px] font-semibold">
              <span>{formatMeters(routeInfo.distanceMeters)}</span>
              <span className="text-muted-foreground">·</span>
              <span>~{formatDuration(routeInfo.durationSeconds)}</span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Fastest route</span>
            </div>
          )}
          <div className="my-3 h-px bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Vehicle</p>
              <p className="mt-1 text-base font-bold">{vehicle.name}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">ETA</p>
              <p className="mt-1 text-base font-bold">{vehicle.eta}</p>
            </div>
          </div>
          <div className="my-3 h-px bg-border" />
          <div className="space-y-1 text-xs">
            <Row label="Base fare" value={`₹${vehicle.price}`} />
            <Row label="Smart Route" value={useSmartRoute ? `−${smartSavings} min saved` : "—"} accent={useSmartRoute} />
            <Row label="Platform fee" value="₹4" />
            <Row label="Taxes" value="₹3" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <p className="text-sm font-bold">Total</p>
            <p className="text-xl font-extrabold">₹{fare}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 px-6">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment</p>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => {
            const active = m.id === payment;
            return (
              <button
                key={m.id}
                onClick={() => setPayment(m.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active ? "border-foreground bg-secondary text-secondary-foreground" : "border-border bg-background"
                }`}
              >
                <p className="text-sm font-bold">{m.label}</p>
                <p className={`mt-1 text-[10px] ${active ? "text-secondary-foreground/60" : "text-muted-foreground"}`}>{m.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 pb-12">
        <button
          onClick={onNext}
          disabled={busy}
          className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95 disabled:opacity-60"
        >
          {busy ? "Requesting…" : `Book · ₹${fare}`}
        </button>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          OTP shared with captain on pickup
        </p>
      </div>
    </>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-bold text-accent" : "font-semibold"}>{value}</span>
    </div>
  );
}

/* ---------- Searching ---------- */
function SearchingStep({ onCancel }: { onCancel: () => void }) {
  return (
    <>
      <div className="mb-4 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Matching</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Finding a captain</h2>
        <p className="mt-1 text-xs text-muted-foreground">Pinging nearby riders…</p>
      </div>
      <div className="mb-6 px-6">
        <div className="rounded-2xl bg-muted p-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <p className="text-xs font-semibold">Broadcasting to nearby captains</p>
          </div>
          <p className="mt-2 text-[10px] font-mono uppercase text-muted-foreground">
            Open <span className="font-bold">/captain</span> in another tab to accept this ride.
          </p>
        </div>
      </div>
      <div className="px-6 pb-12">
        <button
          onClick={onCancel}
          className="h-14 w-full rounded-full border border-border bg-background text-sm font-bold transition-transform active:scale-95"
        >
          Cancel search
        </button>
      </div>
    </>
  );
}

/* ---------- Matched ---------- */
function MatchedStep({ ride }: { ride: Ride }) {
  // Animate captain toward pickup after matching
  useCaptainToPickup(ride);
  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Captain matched</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{ride.captain_name ?? "On the way"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {ride.captain_rating ? `★ ${Number(ride.captain_rating).toFixed(1)}` : ""}
        </p>
      </div>

      <div className="mb-6 px-6">
        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Vehicle</p>
              <p className="mt-1 text-sm font-bold">{ride.captain_vehicle ?? "—"}</p>
            </div>
            <p className="rounded-full bg-primary px-3 py-1 font-mono text-xs font-bold text-secondary">
              {ride.captain_plate ?? "—"}
            </p>
          </div>
          <div className="my-3 h-px bg-border" />
          <div>
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Share OTP on pickup</p>
            <div className="mt-2 flex gap-2">
              {ride.otp.split("").map((d: string, i: number) => (
                <span key={i} className="grid h-11 w-9 place-items-center rounded-lg bg-secondary text-lg font-extrabold text-primary">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="grid grid-cols-2 gap-2">
          <button className="h-12 rounded-full border border-border bg-background text-sm font-bold">Call</button>
          <button className="h-12 rounded-full border border-border bg-background text-sm font-bold">Message</button>
        </div>
      </div>
    </>
  );
}

// Simulate the captain closing distance to pickup: emit location pings, then flip status to "arriving".
function useCaptainToPickup(ride: Ride) {
  useEffect(() => {
    if (ride.status !== "accepted") return;
    // Start ~1km away and interpolate toward pickup over ~10 seconds
    const start = {
      lat: ride.pickup_lat + 0.008,
      lng: ride.pickup_lng + 0.010,
    };
    const end = { lat: ride.pickup_lat, lng: ride.pickup_lng };
    const path = [start, end];
    let i = 0;
    const steps = 8;
    const t = setInterval(async () => {
      i++;
      const pos = pointAt(path, Math.min(i / steps, 1));
      await rideApi.updateLocation(ride.id, pos.lat, pos.lng);
      if (i >= steps) {
        clearInterval(t);
        await rideApi.updateStatus(ride.id, "arriving");
      }
    }, 1200);
    return () => clearInterval(t);
  }, [ride.id, ride.status]);
}

/* ---------- Generic in-ride status ---------- */
function RideStatusStep({
  title, subtitle, ride, onNext, ctaLabel,
}: {
  title: string;
  subtitle: string;
  ride: Ride;
  onNext: () => void;
  ctaLabel: string;
}) {
  // During in_progress: animate captain along route from pickup to drop
  useCaptainDriving(ride);

  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Live</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mb-6 px-6">
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-secondary-foreground">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary font-bold text-secondary">
            {(ride.captain_name ?? "R").charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{ride.captain_name ?? "Captain"}</p>
            <p className="text-[10px] text-secondary-foreground/60">{ride.captain_plate ?? ""}</p>
          </div>
          <button className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-secondary">Call</button>
        </div>
      </div>

      <div className="mb-6 px-6">
        <button className="w-full rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-xs font-bold text-destructive">
          SOS · Share ride with contacts
        </button>
      </div>

      <div className="px-6 pb-8">
        <button
          onClick={onNext}
          className="h-14 w-full rounded-full bg-primary text-base font-bold text-secondary shadow-xl transition-transform active:scale-95"
        >
          {ctaLabel}
        </button>
      </div>
    </>
  );
}

function useCaptainDriving(ride: Ride) {
  useEffect(() => {
    if (ride.status !== "in_progress") return;
    // Fetch route polyline for animation
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const res = await computeRoute({
          data: {
            origin: { lat: ride.pickup_lat, lng: ride.pickup_lng },
            destination: { lat: ride.drop_lat, lng: ride.drop_lng },
            travelMode: ride.vehicle_type === "auto" ? "DRIVE" : "TWO_WHEELER",
          },
        });
        if (cancelled) return;
        const path = res.encodedPolyline ? decodePolyline(res.encodedPolyline) : [
          { lat: ride.pickup_lat, lng: ride.pickup_lng },
          { lat: ride.drop_lat, lng: ride.drop_lng },
        ];
        let i = 0;
        const steps = 14;
        interval = setInterval(async () => {
          i++;
          const pos = pointAt(path, Math.min(i / steps, 1));
          await rideApi.updateLocation(ride.id, pos.lat, pos.lng);
          if (i >= steps && interval) {
            clearInterval(interval);
          }
        }, 1500);
      } catch (e) {
        console.warn(e);
      }
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [ride.id, ride.status]);
}

/* ---------- Completed ---------- */
function CompletedStep({ fare, onNext }: { fare: number; onNext: () => void }) {
  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Arrived</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">You&apos;ve reached</h2>
      </div>

      <div className="mb-6 px-6">
        <div className="rounded-2xl border border-border p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold">Total to pay</p>
            <p className="text-3xl font-extrabold">₹{fare}</p>
          </div>
          <div className="my-4 h-px bg-border" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Distance" value="8.4 km" />
            <Stat label="Duration" value="22 min" />
            <Stat label="Saved" value="12 min" accent />
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <button
          onClick={onNext}
          className="h-14 w-full rounded-full bg-primary text-base font-bold text-secondary shadow-xl transition-transform active:scale-95"
        >
          Pay & rate
        </button>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-extrabold ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

/* ---------- Rating ---------- */
function RatingStep({
  captainName, rating, setRating, tip, setTip, onDone,
}: {
  captainName: string;
  rating: number;
  setRating: (n: number) => void;
  tip: number;
  setTip: (n: number) => void;
  onDone: () => void;
}) {
  const tips = [0, 10, 20, 50];
  return (
    <>
      <div className="mb-4 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Feedback</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Rate {captainName}</h2>
      </div>

      <div className="mb-6 flex justify-center gap-2 px-6">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            className={`grid h-12 w-12 place-items-center rounded-full text-2xl transition ${
              n <= rating ? "bg-primary text-secondary" : "bg-muted text-muted-foreground"
            }`}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
      </div>

      <div className="mb-6 px-6">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add a tip</p>
        <div className="grid grid-cols-4 gap-2">
          {tips.map((t) => {
            const active = t === tip;
            return (
              <button
                key={t}
                onClick={() => setTip(t)}
                className={`rounded-2xl border py-3 text-sm font-bold transition ${
                  active ? "border-foreground bg-secondary text-secondary-foreground" : "border-border bg-background"
                }`}
              >
                {t === 0 ? "None" : `₹${t}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 pb-12">
        <button
          onClick={onDone}
          disabled={rating === 0}
          className="h-14 w-full rounded-full bg-primary text-base font-bold text-secondary shadow-xl transition-transform active:scale-95 disabled:opacity-40"
        >
          Submit · Book another
        </button>
      </div>
    </>
  );
}
