import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CancelAcceptedRide } from "@/components/rc/CancelAcceptedRide";
import { loadCustomerActiveRide, cancelRideConfirmed, cancelAcceptedRide } from "@/lib/booking";
import { RequireRole } from "@/components/rc/RequireRole";
import { RideSafety } from "@/components/rc/RideSafety";
import { RoleNav } from "@/components/rc/RoleNav";
import { RideMap } from "@/components/rc/RideMap";
import { PlaceSearch, type PlaceResult } from "@/components/rc/PlaceSearch";
import {
  RequestError,
  API_BASE_URL,
  captainAvailabilityApi,
  captainMapApi,
  rideApi,
  storage,
  vehicleTypesApi,
  walletApi,
  type BookingDetails,
  type CanonicalRide,
  type VehicleTypeId,
} from "@/lib/api";
import { computeRoute } from "@/lib/routes.functions";
import { getDeviceId } from "@/lib/device-id";
import { decodePolyline, pointAt } from "@/lib/polyline";
import { generateOtp, type Ride, type RideStatus } from "@/lib/rides";
import { io, Socket } from "socket.io-client";
import { paymentApi, parseCreateRide, type PaymentIntent, type PaymentStatus } from "@/lib/api";
import {
  defaultPaymentMethod,
  needsOnlinePayment,
  secondsUntil,
  toServerPayment,
} from "@/lib/payments";
import { useServerFn } from "@tanstack/react-start";
import {
  confirmRazorpayPayment,
  createRazorpayPayment,
} from "@/lib/razorpay.functions";
import {
  RAZORPAY_CHECKOUT_DISMISSED,
  openRazorpayCheckout,
} from "@/lib/razorpay";

export const Route = createFileRoute("/ride")({
  head: () => ({
    meta: [
      { title: "Book a ride — RIDEHER" },
      {
        name: "description",
        content: "Bike, auto, and EV rides with community-verified smart routes.",
      },
    ],
  }),
  component: () => (
    <RequireRole role="CUSTOMER">
      <RidePage />
    </RequireRole>
  ),
});

type Vehicle = { id: string; name: string; price: number; eta: string; note?: string };
const vehicles: Vehicle[] = [
  { id: "bike", name: "Bike", price: 45, eta: "3 min" },
  { id: "auto", name: "Auto", price: 78, eta: "6 min" },
  { id: "cab", name: "Cab", price: 120, eta: "8 min" },
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
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  // If we're already within 30m of this step's end, advance to the next.
  if (bestD * 1000 < 30 && best < steps.length - 1) return best + 1;
  return best;
}

type UiStep =
  | "destination"
  | "vehicle"
  | "confirm"
  | "payment"
  | "searching"
  | "matched"
  | "arriving"
  | "inprogress"
  | "completed"
  | "cancelled"
  | "rating";

type Payment = "wallet" | "upi" | "cash" | "card";

function stepFromStatus(status: RideStatus): UiStep {
  switch (status) {
    case "destination":
      return "destination";
    case "vehicle":
      return "vehicle";
    case "confirm":
      return "confirm";
    case "searching":
      return "searching";
    case "accepted":
      return "matched";
    case "arriving":
      return "arriving";
    case "in_progress":
      return "inprogress";
    case "completed":
      return "completed";
    case "rating":
      return "rating";
    case "rated":
      return "rating";
    case "cancelled":
      return "cancelled";
    default:
      return "searching";
  }
}

function mapRideStatus(status: string | undefined): RideStatus {
  switch (status) {
    case "SEARCHING":
      return "searching";
    case "MATCHED":
      return "accepted";
    case "ARRIVING":
      return "arriving";
    case "IN_PROGRESS":
      return "in_progress";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    default:
      return (status as RideStatus) || "searching";
  }
}

function toClientRide(source: CanonicalRide | BookingDetails): Ride {
  const details = source as BookingDetails;
  const ride = source as CanonicalRide;
  const pickup = details.pickup ?? {
    lat: ride.pickupLat,
    lng: ride.pickupLng,
    address: ride.pickupAddress,
  };
  const drop = details.drop ?? { lat: ride.dropLat, lng: ride.dropLng, address: ride.dropAddress };
  return {
    id: details.rideId ?? ride.id,
    rider_user_id: "",
    pickup_label: pickup.address,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    drop_label: drop.address,
    drop_lat: drop.lat,
    drop_lng: drop.lng,
    vehicle_type:
      (details.vehicleType ?? ride.vehicleType).toLowerCase() === "cab"
        ? "auto"
        : ((details.vehicleType ?? ride.vehicleType).toLowerCase() as "bike" | "auto" | "ev"),
    fare_inr: details.fareEstimate ?? ride.fareEstimate,
    status: mapRideStatus(details.status ?? ride.status),
    // Keep the OTP returned at booking time while the matched-details poll is
    // in flight. It is deliberately not part of captain-facing responses.
    otp: details.otp ?? ride.otp ?? "",
    captain_name: details.captain?.name,
    captain_phone: details.captain?.phone ?? undefined,
    captain_vehicle: details.captain?.vehicleModel ?? details.captain?.vehicleType ?? undefined,
    captain_plate: details.captain?.vehicleNumber ?? undefined,
    captain_rating: details.captain?.rating ?? undefined,
    captain_lat: details.captainLocation?.lat,
    captain_lng: details.captainLocation?.lng,
    captain_avatar: details.captain?.avatarUrl ?? undefined,
    created_at: "",
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
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
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [locating, setLocating] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<null | "denied" | "unavailable" | "timeout">(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [destQuery, setDestQuery] = useState("");
  const [dest, setDest] = useState<PlaceResult | null>(null);
  const [payment, setPayment] = useState<Payment>("upi");
  const [useSmartRoute, setUseSmartRoute] = useState(false);
  const [ride, setRide] = useState<Ride | null>(null);
  const [recovering, setRecovering] = useState(true);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const cancellationRef = useRef(false);
  const recoveredRideRef = useRef(false);

  useEffect(() => {
    if (!storage.getAccessToken()) {
      setRecovering(false);
      return;
    }
    let disposed = false;
    async function recover() {
      try {
        const recovered = await loadCustomerActiveRide();
        if (!recovered) return;
        const active = recovered.history;
        const response = { data: recovered.details };
        const restored = toClientRide(response.data);
        if (disposed) return;
        recoveredRideRef.current = true;
        firstFixRef.current = true;
        setLocating(false);
        setRide(restored);
        setPickup({
          label: restored.pickup_label,
          lat: restored.pickup_lat,
          lng: restored.pickup_lng,
        });
        setDest({
          name: restored.drop_label,
          addr: restored.drop_label,
          lat: restored.drop_lat,
          lng: restored.drop_lng,
        });
        if (
          ["UPI", "CARD"].includes(active.paymentMethod ?? "") &&
          active.paymentStatus !== "PAID" &&
          active.status === "SEARCHING"
        ) {
          setPayment(active.paymentMethod === "CARD" ? "card" : "upi");
          awaitingPaymentRef.current = true;
          setPaymentIntent(active.paymentIntents?.[0] ?? {});
          setStep("payment");
        } else setStep(stepFromStatus(restored.status));
      } catch {
        if (!disposed)
          setBookingError(
            "Could not check for an existing ride. Reload before booking to avoid duplicate trips.",
          );
      } finally {
        if (!disposed) setRecovering(false);
      }
    }
    void recover();
    return () => {
      disposed = true;
    };
  }, []);
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

  const [routeInfo, setRouteInfo] = useState<{
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [fareQuotes, setFareQuotes] = useState<
    Partial<Record<"bike" | "auto" | "ev" | "cab", number>>
  >({});
  const [vehicleAvailability, setVehicleAvailability] = useState<
    Partial<Record<"BIKE" | "AUTO" | "CAB", boolean>>
  >({});
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletShortfall, setWalletShortfall] = useState<{ balance: number; fare: number } | null>(
    null,
  );
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupBusy, setTopupBusy] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [redispatching, setRedispatching] = useState(false);
  const [rateComment, setRateComment] = useState("");
  const awaitingPaymentRef = useRef(false);
  const paymentPickedRef = useRef(false);
  const idemKeyRef = useRef<string | null>(null);
  const stepRef = useRef<UiStep>("destination");
  const [activeCaptains, setActiveCaptains] = useState<number | null>(null);
  const [nearbyCaptains, setNearbyCaptains] = useState<{ lat: number; lng: number }[]>([]);

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
        if (recoveredRideRef.current) return;
        setPickup({ label: "Current location", ...p });
        setPickupConfirmed(true);
        firstFixRef.current = true;
        setLocating(false);
        reverseGeocode(p.lat, p.lng).then((addr) => {
          if (addr)
            setPickup((prev) =>
              prev.lat === p.lat && prev.lng === p.lng ? { ...prev, label: addr } : prev,
            );
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
    // A persisted profile without its token can happen after logout or a
    // storage cleanup. Do not let the public map/fare effects send anonymous
    // requests to customer-only API endpoints.
    if (!user || !storage.getAccessToken()) {
      storage.clearAuth();
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
          setPickupConfirmed(true);
          firstFixRef.current = true;
          setLocating(false);
          reverseGeocode(p.lat, p.lng).then((addr) => {
            if (addr)
              setPickup((prev) =>
                prev.lat === p.lat && prev.lng === p.lng ? { ...prev, label: addr } : prev,
              );
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
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vehicle = useMemo(() => vehicles.find((v) => v.id === selected)!, [selected]);
  const fare = fareQuotes[selected as "bike" | "auto" | "ev" | "cab"] ?? vehicle.price;
  const smartSavings = 0;
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  // Wallet is the default method whenever its balance covers the fare.
  useEffect(() => {
    if (paymentPickedRef.current) return;
    setPayment(defaultPaymentMethod(walletBalance, fare));
  }, [walletBalance, fare]);

  // Real-time ride updates via Socket.IO
  useEffect(() => {
    if (!ride?.id) return;

    const token = storage.getAccessToken();
    const socket = io(API_BASE_URL.replace("/api/v1", ""), {
      auth: { token },
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    let disposed = false;
    const refreshBooking = async () => {
      try {
        const response = await rideApi.bookingDetails(ride.id);
        if (disposed || cancellationRef.current) return;
        const updatedRide = toClientRide(response.data);
        // Some older API deployments omit the customer OTP from a later
        // booking-details response. Never let that refresh erase the OTP we
        // received when the customer created the ride or when it was matched.
        setRide((current) => ({
          ...updatedRide,
          otp: updatedRide.otp || current?.otp || "",
        }));
        const next = stepFromStatus(updatedRide.status);
        if (next === "cancelled") {
          awaitingPaymentRef.current = false;
          setPaymentIntent(null);
        }
        // While the customer is paying, the ride stays on the payment screen.
        if (!(awaitingPaymentRef.current && next === "searching")) {
          const prev = stepRef.current;
          if (next === "searching" && (prev === "matched" || prev === "arriving"))
            setRedispatching(true);
          if (next !== "searching") setRedispatching(false);
          setStep(next);
        }
        if (response.data.captainLocation) setCaptainPos(response.data.captainLocation);
      } catch (error) {
        console.warn("Could not refresh ride booking details", error);
      }
    };

    socket.on(
      "ride:matched",
      (data: {
        rideId?: string;
        otp?: string;
        captain?: {
          name?: string;
          phone?: string | null;
          avatarUrl?: string | null;
          vehicleModel?: string;
          vehicleType?: string;
          vehicleNumber?: string;
          rating?: number;
        };
        captainLocation?: { lat: number; lng: number } | null;
      }) => {
        if (data.rideId !== ride.id) return;
        setRide((current) =>
          current
            ? {
                ...current,
                status: "accepted",
                otp: data.otp ?? current.otp,
                captain_name: data.captain?.name ?? current.captain_name,
                captain_phone: data.captain?.phone ?? current.captain_phone,
                captain_avatar: data.captain?.avatarUrl ?? current.captain_avatar,
                captain_vehicle:
                  data.captain?.vehicleModel ??
                  data.captain?.vehicleType ??
                  current.captain_vehicle,
                captain_plate: data.captain?.vehicleNumber ?? current.captain_plate,
                captain_rating: data.captain?.rating ?? current.captain_rating,
                captain_lat: data.captainLocation?.lat ?? current.captain_lat,
                captain_lng: data.captainLocation?.lng ?? current.captain_lng,
              }
            : current,
        );
        if (data.captainLocation) setCaptainPos(data.captainLocation);
        awaitingPaymentRef.current = false;
        setRedispatching(false);
        setStep("matched");
        void refreshBooking();
      },
    );
    socket.on("captain:location", (data: { rideId?: string; lat?: number; lng?: number }) => {
      if (data.rideId !== ride.id || typeof data.lat !== "number" || typeof data.lng !== "number")
        return;
      setCaptainPos({ lat: data.lat, lng: data.lng });
      setRide((current) =>
        current ? { ...current, captain_lat: data.lat, captain_lng: data.lng } : current,
      );
    });
    socket.on("ride:searching", (data: { rideId?: string }) => {
      if (data?.rideId && data.rideId !== ride.id) return;
      const prev = stepRef.current;
      if (prev === "matched" || prev === "arriving") {
        setRedispatching(true);
        setCaptainPos(null);
        setApproachPolyline("");
        setStep("searching");
      }
    });
    socket.on("ride:arriving", refreshBooking);
    socket.on("ride:started", refreshBooking);
    socket.on("ride:completed", refreshBooking);
    socket.on("ride:cancelled", (data: { rideId?: string; status?: string }) => {
      if (data.rideId === ride.id) {
        awaitingPaymentRef.current = false;
        setPaymentIntent(null);
        // Cancellation is terminal. Clear the active booking immediately so
        // the rider is not trapped on a stale matched/current-ride screen.
        setRide(null);
        setApproachPolyline("");
        setCaptainPos(null);
        setStep("destination");
      }
    });

    // Socket delivery is immediate when available. Polling keeps the customer
    // portal in sync when Socket.IO is blocked by browser or deployment CORS.
    void refreshBooking();
    const pollId = window.setInterval(() => void refreshBooking(), 5000);

    return () => {
      disposed = true;
      socket.disconnect();
      window.clearInterval(pollId);
    };
  }, [ride?.id]);

  // Fetch captain -> pickup route once we have a captain position (matching/pickup phase)
  useEffect(() => {
    if (!ride || !captainPos) return;
    if (ride.status !== "accepted" && ride.status !== "arriving") {
      setApproachPolyline("");
      approachFetchedRef.current = null;
      return;
    }
    // Recompute when the captain's live position changes; otherwise the
    // approach line stays anchored at the first reported location.
    const approachKey = `${ride.id}:${captainPos.lat.toFixed(5)}:${captainPos.lng.toFixed(5)}`;
    if (approachFetchedRef.current === approachKey) return;
    approachFetchedRef.current = approachKey;
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
            travelMode: selected === "auto" || selected === "cab" ? "DRIVE" : "TWO_WHEELER",
          },
        });
        if (!cancelled) {
          if (!res.encodedPolyline) {
            setRouteError("No route found between these points.");
          }
          setEncodedPolyline(res.encodedPolyline || "");
          setRouteSteps(res.steps ?? []);
          setRouteInfo({
            distanceMeters: res.distanceMeters ?? 0,
            durationSeconds: res.durationSeconds ?? 0,
          });
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("route fetch failed", e);
          // Fallback to simple straight line if API fails
          setRouteError(null);
          setEncodedPolyline("");
          setRouteSteps([]);
          setRouteInfo({
            distanceMeters: haversineKm(pickup, dest) * 1000,
            durationSeconds: (haversineKm(pickup, dest) / 25) * 3600,
          });
        }
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dest?.lat, dest?.lng, pickup.lat, pickup.lng, selected]);

  // Quotes are calculated by the same backend route and fare services used
  // when a ride is created. The browser never supplies a fare to the API.
  useEffect(() => {
    if (!dest || !storage.getAccessToken()) {
      setFareQuotes({});
      return;
    }
    let cancelled = false;
    setFareQuotes({});
    setQuotePending(true);
    setQuoteError(false);
    rideApi
      .estimate({
        pickup: { latitude: pickup.lat, longitude: pickup.lng },
        destination: { latitude: dest.lat, longitude: dest.lng },
      })
      .then((response) => {
        if (cancelled) return;
        const quotes: Partial<Record<"bike" | "auto" | "ev" | "cab", number>> = {};
        response.data.estimates.forEach((estimate) => {
          if (estimate.vehicleType === "BIKE") {
            quotes.bike = estimate.max;
            quotes.ev = estimate.max;
          }
          if (estimate.vehicleType === "AUTO") quotes.auto = estimate.max;
          if (estimate.vehicleType === "CAB") quotes.cab = estimate.max;
        });
        setFareQuotes(quotes);
        setRouteInfo({
          distanceMeters: response.data.distanceMeters,
          durationSeconds: response.data.durationSeconds,
        });
        if (response.data.polyline) setEncodedPolyline(response.data.polyline);
      })
      .catch(() => {
        if (!cancelled) {
          setFareQuotes({});
          setQuoteError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setQuotePending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dest?.lat, dest?.lng, pickup.lat, pickup.lng, quoteAttempt]);

  useEffect(() => {
    if (!storage.getAccessToken()) return;
    const vehicleType = selected === "auto" ? "AUTO" : selected === "cab" ? "CAB" : "BIKE";
    const refreshAvailability = () =>
      captainAvailabilityApi
        .get(vehicleType)
        .then((response) => setActiveCaptains(response.data.activeCaptains))
        .catch(() => setActiveCaptains(null));
    refreshAvailability();
    const interval = window.setInterval(refreshAvailability, 30000);
    return () => window.clearInterval(interval);
  }, [selected]);

  // Vehicle-type availability comes from the cities/zones admin module. Every
  // supported type stays visible; unavailable ones render disabled.
  useEffect(() => {
    if (!storage.getAccessToken()) return;
    let cancelled = false;
    vehicleTypesApi
      .get()
      .then((types) => {
        if (!cancelled) setVehicleAvailability(types);
      })
      .catch(() => {
        if (!cancelled) setVehicleAvailability({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wallet balance is checked before booking so a low balance shows a friendly
  // top-up prompt instead of a raw server error after submission.
  useEffect(() => {
    if (step !== "confirm" || !storage.getAccessToken()) return;
    let cancelled = false;
    setWalletShortfall(null);
    walletApi
      .get()
      .then((wallet) => {
        if (cancelled) return;
        setWalletBalance(wallet.balance);
        if (wallet.balance >= fare) setWalletShortfall(null);
      })
      .catch(() => {
        if (!cancelled) setWalletBalance(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, fare]);

  useEffect(() => {
    if (!storage.getAccessToken()) return;
    const vehicleType = selected === "auto" ? "AUTO" : selected === "cab" ? "CAB" : "BIKE";
    const refreshMapCaptains = () =>
      captainMapApi
        .get(pickup.lat, pickup.lng, vehicleType)
        .then((response) => setNearbyCaptains(response.data.captains))
        .catch(() => setNearbyCaptains([]));
    refreshMapCaptains();
    const interval = window.setInterval(refreshMapCaptains, 30000);
    return () => window.clearInterval(interval);
  }, [pickup.lat, pickup.lng, selected]);

  async function createRide() {
    if (
      !dest ||
      recovering ||
      bookingError ||
      creating ||
      quotePending ||
      quoteError ||
      fareQuotes[selected as keyof typeof fareQuotes] == null
    )
      return;
    if (!storage.getAccessToken()) {
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    if (!pickupConfirmed) {
      alert("Confirm your pickup location before booking a ride.");
      setStep("destination");
      return;
    }
    // Wallet pre-check: never submit a booking the balance can't cover.
    if (payment === "wallet" && walletBalance != null && walletBalance < fare) {
      setWalletShortfall({ balance: walletBalance, fare });
      return;
    }
    setWalletShortfall(null);
    // Same key on network retries so the server never books twice.
    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();
    setCreating(true);
    try {
      const response = await rideApi.create(
        {
          pickupAddress: pickup.label,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropAddress: dest.addr,
          dropLat: dest.lat,
          dropLng: dest.lng,
          // Backend accepts only BIKE | AUTO | CAB — EV bikes book as BIKE.
          vehicleType: (selected === "ev" ? "BIKE" : selected.toUpperCase()) as
            "BIKE" | "AUTO" | "CAB",
          paymentMethod: toServerPayment(payment),
        },
        idemKeyRef.current,
      );
      const created = parseCreateRide(response);
      setRide(toClientRide(created.ride));
      idemKeyRef.current = null;
      if (needsOnlinePayment(payment)) {
        awaitingPaymentRef.current = true;
        setPaymentIntent(created.paymentIntent ?? {});
        setStep("payment");
      } else {
        setStep("searching");
      }
    } catch (e) {
      console.error(e);
      const apiError = e instanceof RequestError ? e.error : undefined;
      const code = apiError?.code;
      // The server can still reject the booking for a low wallet — show the
      // same friendly top-up prompt instead of the raw error string.
      const errText = `${code ?? ""} ${apiError?.message ?? ""}`.toLowerCase();
      if (
        (errText.includes("wallet") && errText.includes("balance")) ||
        errText.includes("insufficient")
      ) {
        setWalletShortfall({ balance: walletBalance ?? 0, fare });
        return;
      }
      const msg =
        code === "EXTERNAL_API_ERROR"
          ? "The RIDEHER booking service is temporarily unavailable. Please try again shortly."
          : apiError?.message || "Couldn't create ride. Try again.";
      alert(msg);
    } finally {
      setCreating(false);
    }
  }

  const createRazorpayOrderFn = useServerFn(createRazorpayPayment);
  const confirmRazorpayPaymentFn = useServerFn(confirmRazorpayPayment);

  // Wallet top-up: pay through Razorpay test checkout, then credit the wallet
  // on the RIDEHER backend once the payment verifies.
  async function handleTopup(amount: number) {
    setTopupBusy(true);
    try {
      const order = await createRazorpayOrderFn({
        data: { amount, description: "RIDEHER wallet top-up" },
      });
      if (!order.ok) {
        alert("Payment checkout isn't available right now. Please try again shortly.");
        return;
      }
      let paid;
      try {
        paid = await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: order.amount,
          name: "RIDEHER",
          description: "Wallet top-up",
        });
      } catch (e) {
        if ((e as Error)?.message === RAZORPAY_CHECKOUT_DISMISSED) return;
        throw e;
      }
      const check = await confirmRazorpayPaymentFn({
        data: {
          orderId: paid.razorpay_order_id,
          paymentId: paid.razorpay_payment_id,
          signature: paid.razorpay_signature,
          expectedAmount: order.amount,
        },
      });
      if (!check.ok) {
        alert(
          "We couldn't verify the payment. If money was debited, it will be refunded automatically.",
        );
        return;
      }
      const { balance } = await walletApi.topup(amount);
      setWalletBalance(balance);
      setTopupOpen(false);
    } catch (e) {
      console.error("Wallet top-up failed", e);
      alert("Couldn't complete the top-up. Please try again.");
    } finally {
      setTopupBusy(false);
    }
  }

  function onPaid() {
    awaitingPaymentRef.current = false;
    setPaymentIntent(null);
    setStep("searching");
  }

  async function confirmCancellation(reason: string): Promise<boolean> {
    if (cancellationRef.current) return false;
    cancellationRef.current = true;
    try {
      if (ride) await cancelRideConfirmed(ride.id, reason);
      return true;
    } catch {
      alert("Cancellation was not confirmed. Your ride is still shown. Please try again.");
      return false;
    } finally {
      cancellationRef.current = false;
    }
  }

  function clearPendingRide() {
    awaitingPaymentRef.current = false;
    setPaymentIntent(null);
    setRide(null);
    idemKeyRef.current = null;
  }

  async function switchPaymentMethod() {
    if (!(await confirmCancellation("Switching payment method"))) return;
    clearPendingRide();
    paymentPickedRef.current = false;
    setStep("confirm");
  }

  async function retryPayment() {
    if (!(await confirmCancellation("Retrying payment"))) return;
    clearPendingRide();
    await createRide();
  }

  async function cancelDuringPayment() {
    if (!(await confirmCancellation("Cancelled during payment"))) return;
    clearPendingRide();
    setStep("destination");
  }

  async function cancelBeforeStart() {
    if (!ride || cancellationRef.current) throw new Error("Cancellation is already in progress.");
    cancellationRef.current = true;
    try {
      await cancelAcceptedRide(ride.id);
      clearPendingRide();
      setRedispatching(false);
      setApproachPolyline("");
      setCaptainPos(null);
      setStep("cancelled");
    } finally {
      cancellationRef.current = false;
    }
  }

  async function cancelSearch() {
    if (!(await confirmCancellation("Cancelled by customer"))) return;
    clearPendingRide();
    setRedispatching(false);
    setEncodedPolyline("");
    setRouteSteps([]);
    setApproachPolyline("");
    approachFetchedRef.current = null;
    setCaptainPos(null);
    setStep("confirm");
  }

  async function submitRating() {
    if (!ride) return;
    try {
      await rideApi.rate(ride.id, {
        stars: rating,
        tip: tip || undefined,
        comment: rateComment.trim() || undefined,
      });
    } catch (e) {
      alert("Your rating could not be saved. Please try again.");
      return;
    }
    setRateComment("");
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
  const mapDrop = dest
    ? { lat: dest.lat, lng: dest.lng }
    : { lat: pickup.lat + 0.03, lng: pickup.lng + 0.03 };

  // Which polyline to draw: captain approach during matching/pickup, main route otherwise.
  const activePolyline =
    (step === "matched" || step === "arriving") && approachPolyline
      ? approachPolyline
      : encodedPolyline;

  // Live ETA (in minutes) — haversine distance / assumed average speed.
  const etaTarget =
    step === "matched" || step === "arriving" ? mapPickup : step === "inprogress" ? mapDrop : null;
  const etaMinutes =
    captainPos && etaTarget ? computeEtaMinutes(captainPos, etaTarget, selected) : null;
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
  const nextStep =
    activeStepIdx >= 0 && activeStepIdx + 1 < routeSteps.length
      ? routeSteps[activeStepIdx + 1]
      : null;
  const distanceToTurn =
    currentStep && captainPos
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

  if (recovering || bookingError)
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p role="status">{bookingError ?? "Checking for an existing ride…"}</p>
        {bookingError && (
          <button className="mt-4 underline" onClick={() => window.location.reload()}>
            Try again
          </button>
        )}
        <RoleNav />
      </div>
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col border-x border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          <div className="hidden">
            '''Do not make any visual modifications. The phrases I write are commands to understand
            what I want, not to be written down. Understand their content well, then execute what is
            required.''' Implement the customer booking flow in the existing codebase. Do not add
            text/documentation or mock UI. API integration: POST /api/v1/rides/request — create ride
            request with pickup/drop coordinates, addresses, vehicle type and payment method. GET
            /api/v1/rides/:id/booking-details — fetch booking details. Customer UI: Show pickup and
            drop locations. Show assigned captain profile, phone and vehicle details. Show fare and
            distance. Show captain's live location on the map. Show booking/confirmation status.
            Update the screen using real API data. Handle loading, errors, authentication and
            booking status changes. Use the existing project components and API architecture.
            Actually modify and connect the code; do not create placeholder/mock functionality.
          </div>
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
            nearbyCaptains={ride ? [] : nearbyCaptains}
            userLocation={userLocation}
            polyline={dest ? activePolyline : ""}
            routeLoading={routeLoading}
            routeError={routeError}
            fitKey={step}
            recenterKey={recenterKey}
            recenterTarget={userLocation ?? mapPickup}
            className="absolute inset-0"
          />

          {activeCaptains !== null && (
            <div className="absolute left-4 top-24 flex items-center gap-2 rounded-full bg-card/95 px-3 py-2 text-xs font-bold text-foreground shadow-lg ring-1 ring-black/10 backdrop-blur">
              <span aria-hidden="true" className="text-base">
                🛵
              </span>
              <span>
                {activeCaptains} active captain{activeCaptains === 1 ? "" : "s"} nearby
              </span>
            </div>
          )}

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
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>

          {/* Geolocation error banner — compact, top-anchored so it doesn't cover the map */}
          {geoError && (
            <div className="absolute inset-x-4 top-4 flex items-center gap-2 rounded-full bg-secondary/95 px-3 py-2 text-secondary-foreground shadow-lg ring-1 ring-black/10 backdrop-blur">
              <span className="text-xs font-semibold truncate">
                {geoError === "denied"
                  ? "Location off — set pickup manually"
                  : geoError === "timeout"
                    ? "Location timed out"
                    : "Location unavailable"}
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
                    <p className="mt-0.5 truncate text-sm font-bold">
                      {stripHtml(currentStep.instruction) || "Continue"}
                    </p>
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
                <p className="mt-1 text-xs font-semibold">
                  {locating ? "Locating you…" : pickup.label}
                </p>
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
                <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">
                  {etaLabel}
                </span>
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

        {/* '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                                        
                                            
                                            use this as google maps api key @secret:GOOGLE_API_KEY
                                            
                                            use the google maps with the api key for maps and routes price calculation and booking */}

        {/* Bottom sheet */}
        <div style={{ display: "none" }} aria-hidden="true">
          '''Do not make any visual modifications. The phrases I write are commands to understand
          what I want, not to be written down. Understand their content well, then execute what is
          required.''' Fix the Google Places locationBias error in the RideHer frontend without
          changing any existing UI, booking flow, backend APIs, authentication, or ride logic. The
          browser console currently shows: Google Places unavailable, falling back to OSM
          InvalidValueError: in property locationBias: Invalid LocationBias:
          {"{"}
          "center": {"{"}
          "lat": 28.635097469507716, "lng": 77.4041429713446
          {"}"}, "radius": 30000
          {"}"}
          Required fix Find the Google Places Autocomplete/location-search implementation in the
          frontend that creates the invalid locationBias object. The current implementation is
          using: locationBias: {"{"}
          center: {"{"}
          lat: currentLat, lng: currentLng
          {"}"}, radius: 30000
          {"}"}
          Replace it with the correct Google Places structure: locationBias: {"{"}
          circle: {"{"}
          center: {"{"}
          latitude: currentLat, longitude: currentLng
          {"}"}, radius: 30000
          {"}"}
          {"}"}
          Dynamic location Do not use hard-coded coordinates. The currentLat and currentLng values
          must come from the user's current GPS location. Validate them before creating
          locationBias: Number.isFinite(currentLat) && Number.isFinite(currentLng) If the user's
          location is not available or the coordinates are invalid, do not send locationBias at all.
          The Places search should continue without a location bias. Important requirements Keep
          Google Places as the primary location search provider. Do not replace Google Places with
          OSM. Do not remove the existing Google Maps integration. Do not modify the Google API key.
          Do not change the existing RideHer UI or design. Do not change pickup/drop location
          fields. Do not change the ride request API. Do not change /api/v1/rides/request. Do not
          change customer/captain booking logic. Keep current-location detection working. Search the
          entire frontend codebase for the old locationBias format and fix the relevant Google
          Places implementation. Make sure the implementation matches the Google Places API/library
          currently installed in this project rather than introducing a different Places API
          implementation. Do not blindly change unrelated map configuration. Preserve the existing
          fallback behavior only for genuine Google Places loading/API failures. Also check for this
          Inspect the existing Google Places initialization and confirm that the API libraries
          required for the autocomplete functionality are correctly loaded. Do not add duplicate
          Google Maps script loading if one already exists. Expected behavior After the fix: User
          opens Ride page ↓ Browser gets current GPS location ↓ Google Places Autocomplete loads ↓
          locationBias uses: circle.center.latitude circle.center.longitude circle.radius ↓ User
          searches pickup/drop location ↓ Google Places suggestions appear ↓ No InvalidValueError
          Verification After implementing the fix: Run the frontend build. Confirm there are no
          TypeScript/JavaScript errors. Search the compiled/source code to ensure the old invalid
          structure is no longer being used. Test the /ride page. Test pickup location search. Test
          drop location search. Test with GPS permission enabled. Test when GPS permission is
          denied. Confirm the console no longer shows: InvalidValueError: Invalid LocationBias Make
          only the changes necessary to fix this Google Places error. Do not redesign or refactor
          unrelated parts of the application.
        </div>

        <section className="animate-sheet-up relative -mt-8 rounded-t-[32px] bg-card pt-4 shadow-[0_-20px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-muted" />

          {step === "destination" && (
            <DestinationStep
              pickup={pickup}
              setPickup={(p) => {
                setPickup(p);
                setPickupQuery(p.label);
                setPickupConfirmed(true);
              }}
              pickupQuery={pickupQuery}
              setPickupQuery={setPickupQuery}
              onUseCurrentLocation={() => {
                if (typeof navigator === "undefined" || !navigator.geolocation) return;
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setPickup({ label: "Current location", lat, lng });
                    setPickupQuery("");
                    setPickupConfirmed(true);
                    setLocating(false);
                    reverseGeocode(lat, lng).then((addr) => {
                      if (addr)
                        setPickup((prev) =>
                          prev.lat === lat && prev.lng === lng ? { ...prev, label: addr } : prev,
                        );
                    });
                  },
                  () => setLocating(false),
                  { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
                );
              }}
              locating={locating}
              pickupConfirmed={pickupConfirmed}
              dest={dest}
              setDest={setDest}
              query={destQuery}
              setQuery={setDestQuery}
              onNext={() => dest && setStep("vehicle")}
              routeInfo={routeInfo}
            />
          )}

          {(step === "vehicle" || step === "confirm") && (quotePending || quoteError) && (
            <div className="mx-6 mb-4 rounded border p-3 text-sm" role="status">
              {quotePending ? "Updating fare estimates…" : "Fare estimates are unavailable."}
              {quoteError && (
                <button
                  className="ml-2 underline"
                  onClick={() => setQuoteAttempt(quoteAttempt + 1)}
                >
                  Try again
                </button>
              )}
            </div>
          )}
          {step === "vehicle" && (
            <VehicleStep
              selected={selected}
              setSelected={setSelected}
              useSmartRoute={useSmartRoute}
              setUseSmartRoute={setUseSmartRoute}
              quotes={fareQuotes}
              availability={vehicleAvailability}
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
              setPayment={(p) => {
                paymentPickedRef.current = true;
                setPayment(p);
                setWalletShortfall(null);
              }}
              walletBalance={walletBalance}
              onNext={createRide}
              busy={
                creating ||
                recovering ||
                !!bookingError ||
                quotePending ||
                quoteError ||
                fareQuotes[selected as keyof typeof fareQuotes] == null
              }
              walletShortfall={walletShortfall}
              onAddMoney={() => setTopupOpen(true)}
              routeInfo={routeInfo}
              pickupLabel={pickup.label}
              dropLabel={dest?.addr ?? ""}
            />
          )}

          {step === "payment" && ride && paymentIntent && (
            <PaymentStep
              rideId={ride.id}
              method={payment}
              fare={fare}
              intent={paymentIntent}
              onPaid={onPaid}
              onRetry={retryPayment}
              onSwitch={switchPaymentMethod}
              onCancel={cancelDuringPayment}
            />
          )}

          {step === "searching" && (
            <SearchingStep onCancel={cancelSearch} redispatching={redispatching} />
          )}

          {step === "matched" && ride && (
            <>
              <MatchedStep
                ride={ride}
                cancelSlot={<CancelAcceptedRide onConfirm={cancelBeforeStart} />}
              />
              <RideSafety ride={ride} />
            </>
          )}

          {step === "arriving" && ride && (
            <RideStatusStep
              title="Captain arriving"
              subtitle={`${etaMinutes ?? "—"} min · ${
                distanceRemainingM !== null ? formatMeters(distanceRemainingM) : "—"
              } to pickup${ride.captain_name ? ` · ${ride.captain_name}` : ""}`}
              ride={ride}
              onNext={() => {}}
              ctaLabel="Live tracking"
            />
          )}

          {step === "arriving" && ride && <CancelAcceptedRide onConfirm={cancelBeforeStart} />}

          {step === "inprogress" && ride && (
            <RideStatusStep
              title="On the way"
              subtitle={`${etaMinutes ?? "—"} min · ${
                distanceRemainingM !== null ? formatMeters(distanceRemainingM) : "—"
              } to drop · ${Math.round(tripProgress * 100)}% complete${""}`}
              ride={ride}
              onNext={() => {}}
              ctaLabel="Live tracking"
            />
          )}

          {step === "completed" && ride && (
            <CompletedStep fare={ride.fare_inr} onNext={() => setStep("rating")} ride={ride} />
          )}

          {step === "cancelled" && (
            <div className="px-6 pb-12 pt-6 text-center">
              <h2 className="text-2xl font-extrabold tracking-tight">Ride Cancelled</h2>
              <p className="mt-2 text-sm text-muted-foreground">The ride has been cancelled.</p>
              <button
                onClick={() => {
                  setRide(null);
                  setStep("destination");
                }}
                className="mt-6 h-14 w-full rounded-full bg-primary text-sm font-bold text-secondary shadow-xl transition-transform active:scale-95"
              >
                Back to booking
              </button>
            </div>
          )}

          {step === "rating" && ride && (
            <RatingStep
              captainName={ride.captain_name ?? "your captain"}
              rating={rating}
              setRating={setRating}
              tip={tip}
              setTip={setTip}
              comment={rateComment}
              setComment={setRateComment}
              onDone={submitRating}
            />
          )}
        </section>
      </div>
      <RoleNav />

      {topupOpen && (
        <WalletTopup
          balance={walletBalance}
          busy={topupBusy}
          onClose={() => setTopupOpen(false)}
          onTopup={handleTopup}
        />
      )}
    </div>
  );
}

/* ---------- Step indicator ---------- */
function StepIndicator({ step }: { step: UiStep }) {
  const map: Record<UiStep, string> = {
    destination: "01 · Where to",
    vehicle: "02 · Vehicle",
    confirm: "03 · Confirm",
    payment: "03 · Payment",
    searching: "04 · Matching",
    matched: "05 · Matched",
    arriving: "06 · Pickup",
    inprogress: "07 · En route",
    completed: "08 · Arrived",
    cancelled: "08 · Cancelled",
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
  onUseCurrentLocation,
  locating,
  pickupConfirmed,
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
  onUseCurrentLocation: () => void;
  locating: boolean;
  pickupConfirmed: boolean;
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
              onClick={() => {
                onUseCurrentLocation();
                setEditPickup(false);
              }}
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
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Distance
              </p>
              <p className="mt-1 text-base font-extrabold">
                {formatMeters(routeInfo.distanceMeters)}
              </p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Est. time
              </p>
              <p className="mt-1 text-base font-extrabold">
                {formatDuration(routeInfo.durationSeconds)}
              </p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Route
              </p>
              <p className="mt-1 text-[11px] font-bold">Fastest path</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 pb-6">
        <button
          disabled={!dest || !pickupConfirmed}
          onClick={onNext}
          className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pickupConfirmed ? "Continue" : "Confirm pickup location"}
        </button>
      </div>
    </>
  );
}

/* ---------- Vehicle ---------- */
function VehicleStep({
  selected,
  setSelected,
  useSmartRoute,
  setUseSmartRoute,
  quotes,
  availability,
  onNext,
}: {
  selected: string;
  setSelected: (v: string) => void;
  useSmartRoute: boolean;
  setUseSmartRoute: (v: boolean) => void;
  quotes: Partial<Record<"bike" | "auto" | "ev" | "cab", number>>;
  availability: Partial<Record<VehicleTypeId, boolean>>;
  onNext: () => void;
}) {
  return (
    <>
      <div className="mb-4 px-6">
        <h2 className="text-2xl font-extrabold tracking-tight">Pick your ride</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Fares are estimated by the booking service.
        </p>
      </div>

      <div className="mb-6 flex gap-3 overflow-x-auto px-6 scrollbar-hide">
        {vehicles.map((v) => {
          const active = v.id === selected;
          // EV bikes book as BIKE on the backend, so availability follows BIKE.
          const availabilityKey: VehicleTypeId =
            v.id === "auto" ? "AUTO" : v.id === "cab" ? "CAB" : "BIKE";
          const unavailable =
            availability[availabilityKey] === false || quotes[v.id as keyof typeof quotes] == null;
          return (
            <button
              key={v.id}
              onClick={() => {
                if (!unavailable) setSelected(v.id);
              }}
              disabled={unavailable}
              aria-disabled={unavailable}
              className={`w-32 flex-none rounded-2xl p-4 text-left ring-1 transition ${
                unavailable
                  ? "cursor-not-allowed bg-muted opacity-50 ring-border"
                  : active
                    ? "bg-primary ring-black/5"
                    : "bg-card ring-border hover:ring-foreground/20"
              }`}
            >
              <p className="font-mono text-[10px] font-bold uppercase">
                {v.name}
                {v.note ? <span className="ml-1 text-accent">·{v.note}</span> : null}
              </p>
              <p
                className={`mt-4 text-2xl font-extrabold ${active ? "" : v.id === "ev" ? "text-accent" : ""}`}
              >
                {unavailable
                  ? "—"
                  : quotes[v.id as "bike" | "auto" | "ev" | "cab"]
                    ? `₹${quotes[v.id as "bike" | "auto" | "ev" | "cab"]}`
                    : "Get quote"}
              </p>
              <p
                className={`mt-1 text-[10px] font-semibold ${active ? "opacity-70" : "text-muted-foreground"}`}
              >
                {unavailable ? "Not available" : "Pickup time after matching"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mb-6 rounded-2xl bg-muted mx-6 p-4 text-sm">
        Community route selection is unavailable for booking. Your ride uses the standard road
        route.
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={onNext}
          disabled={quotes[selected as keyof typeof quotes] == null}
          className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95 disabled:opacity-50"
        >
          Review ride
        </button>
      </div>
    </>
  );
}

/* ---------- Confirm ---------- */
function ConfirmStep({
  vehicle,
  fare,
  useSmartRoute,
  smartSavings,
  payment,
  setPayment,
  onNext,
  busy,
  routeInfo,
  pickupLabel,
  dropLabel,
  walletShortfall,
  onAddMoney,
  walletBalance,
}: {
  walletBalance: number | null;
  vehicle: Vehicle;
  fare: number;
  useSmartRoute: boolean;
  smartSavings: number;
  payment: Payment;
  setPayment: (p: Payment) => void;
  onNext: () => void;
  busy: boolean;
  walletShortfall: { balance: number; fare: number } | null;
  onAddMoney: () => void;
  routeInfo: { distanceMeters: number; durationSeconds: number } | null;
  pickupLabel: string;
  dropLabel: string;
}) {
  const methods: { id: Payment; label: string; sub: string }[] = [
    {
      id: "wallet",
      label: "Wallet",
      sub: walletBalance != null ? `₹${walletBalance} balance` : "RIDEHER wallet",
    },
    { id: "upi", label: "UPI", sub: "Scan QR / UPI app" },
    { id: "card", label: "Card", sub: "Secure checkout" },
    { id: "cash", label: "Cash", sub: "Pay on drop" },
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
              <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Fastest route
              </span>
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
            <Row label="Route-based fare estimate" value={`₹${fare}`} />
            <Row
              label="Smart Route"
              value={useSmartRoute ? `−${smartSavings} min saved` : "—"}
              accent={useSmartRoute}
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <p className="text-sm font-bold">Total</p>
            <p className="text-xl font-extrabold">₹{fare}</p>
          </div>
        </div>
      </div>

      {walletShortfall && (
        <div className="mb-4 px-6">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm font-semibold">
              Your wallet balance (₹{walletShortfall.balance}) is not enough for this ride
              (estimated ₹{walletShortfall.fare}). Please add money to your wallet.
            </p>
            <button
              onClick={onAddMoney}
              className="mt-3 h-11 w-full rounded-full bg-primary text-sm font-bold text-secondary"
            >
              Add money
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 px-6">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Payment
        </p>
        <div
          role="radiogroup"
          aria-label="Payment method"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {methods.map((m) => {
            const active = m.id === payment;
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={active}
                onClick={() => setPayment(m.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-foreground bg-secondary text-secondary-foreground"
                    : "border-border bg-background"
                }`}
              >
                <p className="text-sm font-bold">{m.label}</p>
                <p
                  className={`mt-1 text-[10px] ${active ? "text-secondary-foreground/60" : "text-muted-foreground"}`}
                >
                  {m.sub}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={onNext}
          disabled={busy}
          className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95 disabled:opacity-60"
        >
          {busy ? "Requesting…" : `Book · ₹${fare}`}
        </button>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {payment === "upi" || payment === "card"
            ? "You'll pay before we find your captain"
            : "OTP shared with captain on pickup"}
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
function SearchingStep({
  onCancel,
  redispatching,
}: {
  onCancel: () => void;
  redispatching?: boolean;
}) {
  return (
    <>
      <div className="mb-4 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Matching
        </p>
        <div
          className="mx-auto mt-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
          aria-hidden
        />
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
          {redispatching ? "Finding another captain…" : "Searching…"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {redispatching
            ? "Your captain went offline. We're matching you with someone nearby."
            : "Pinging nearby women captains…"}
        </p>
      </div>
      <div className="mb-6 px-6">
        <div className="rounded-2xl bg-muted p-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <p className="text-xs font-semibold">Broadcasting to nearby captains</p>
          </div>
          <p className="mt-2 text-[10px] font-mono uppercase text-muted-foreground">
            We will update this screen when a captain accepts your ride.
          </p>
        </div>
      </div>
      <div className="px-6 pb-6">
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
function MatchedStep({ ride, cancelSlot }: { ride: Ride; cancelSlot?: ReactNode }) {
  // Animate captain toward pickup after matching
  useCaptainToPickup(ride);
  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
          Captain matched
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
          {ride.captain_name ?? "On the way"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {ride.captain_rating
            ? `★ ${Number(ride.captain_rating).toFixed(1)}`
            : "Captain details are syncing…"}
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
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Captain contact
              </p>
              <p className="mt-1 truncate text-sm font-bold">
                {ride.captain_phone ?? "Available once the captain details load"}
              </p>
            </div>
            {ride.captain_phone && (
              <a
                href={`tel:${ride.captain_phone}`}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-bold"
              >
                Call
              </a>
            )}
          </div>
          <div className="my-3 h-px bg-border" />
          <div>
            <p className="font-mono text-[10px] uppercase text-muted-foreground">
              Share OTP on pickup
            </p>
            {ride.otp && (
              <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-primary">
                Share: {ride.otp}
              </p>
            )}
            {ride.otp ? (
              <div className="mt-2 flex gap-2">
                {ride.otp.split("").map((d: string, i: number) => (
                  <span
                    key={i}
                    className="grid h-11 w-9 place-items-center rounded-lg bg-secondary text-lg font-extrabold text-primary"
                  >
                    {d}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                Securing your pickup OTP…
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="grid grid-cols-2 gap-2">
          <a
            href={ride.captain_phone ? `tel:${ride.captain_phone}` : undefined}
            aria-disabled={!ride.captain_phone}
            className={`grid h-12 place-items-center rounded-full border border-border bg-background text-sm font-bold ${ride.captain_phone ? "" : "pointer-events-none opacity-50"}`}
          >
            Call captain
          </a>
          <a
            href={ride.captain_phone ? `sms:${ride.captain_phone}` : undefined}
            aria-disabled={!ride.captain_phone}
            className={`grid h-12 place-items-center rounded-full border border-border bg-background text-sm font-bold ${ride.captain_phone ? "" : "pointer-events-none opacity-50"}`}
          >
            Message
          </a>
        </div>
      </div>

      {cancelSlot}
    </>
  );
}

// Mock simulation removed as backend is now the authority.
function useCaptainToPickup(ride: Ride) {
  // Logic replaced by Socket.IO updates
  useEffect(() => {}, [ride.id]);
}

/* ---------- Generic in-ride status ---------- */
function RideStatusStep({
  title,
  subtitle,
  ride,
  onNext,
  ctaLabel,
}: {
  title: string;
  subtitle: string;
  ride: Ride;
  onNext: () => void;
  ctaLabel: string;
}) {
  // Mock simulation removed as backend is now the authority.
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
        </div>
      </div>

      <RideSafety ride={ride} />
    </>
  );
}

// Mock simulation removed as backend is now the authority.
function useCaptainDriving(ride: Ride) {
  useEffect(() => {}, [ride.id]);
}

/* ---------- Completed ---------- */
function CompletedStep({ fare, onNext, ride }: { fare: number; onNext: () => void; ride: Ride }) {
  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Arrived</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">You&apos;ve reached</h2>
      </div>

      <div className="mb-6 px-6">
        <div className="rounded-2xl border border-border p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold">Total fare</p>
            <p className="text-3xl font-extrabold">₹{fare}</p>
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Ride fare</span>
              <span>₹{Math.round(fare * 0.95)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxes & fees</span>
              <span>₹{fare - Math.round(fare * 0.95)}</span>
            </div>
          </div>
          <div className="my-4 h-px bg-border" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat
              label="Distance"
              value={
                ride
                  ? `${haversineKm({ lat: ride.pickup_lat, lng: ride.pickup_lng }, { lat: ride.drop_lat, lng: ride.drop_lng }).toFixed(1)} km`
                  : "—"
              }
            />
            <Stat
              label="Duration"
              value={
                ride
                  ? `${computeEtaMinutes({ lat: ride.pickup_lat, lng: ride.pickup_lng }, { lat: ride.drop_lat, lng: ride.drop_lng }, ride.vehicle_type)} min`
                  : "—"
              }
            />
            <Stat label="Time saved" value="Unavailable" />
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <button
          onClick={onNext}
          className="h-14 w-full rounded-full bg-primary text-base font-bold text-secondary shadow-xl transition-transform active:scale-95"
        >
          Rate your ride
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
  captainName,
  rating,
  setRating,
  tip,
  setTip,
  comment,
  setComment,
  onDone,
}: {
  comment: string;
  setComment: (s: string) => void;
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
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Feedback
        </p>
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
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Add a tip
        </p>
        <div className="grid grid-cols-4 gap-2">
          {tips.map((t) => {
            const active = t === tip;
            return (
              <button
                key={t}
                onClick={() => setTip(t)}
                className={`rounded-2xl border py-3 text-sm font-bold transition ${
                  active
                    ? "border-foreground bg-secondary text-secondary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {t === 0 ? "None" : `₹${t}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 px-6">
        <label
          className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          htmlFor="rate-comment"
        >
          Comment (optional)
        </label>
        <textarea
          id="rate-comment"
          value={comment}
          maxLength={500}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was your ride?"
          className="min-h-20 w-full rounded-2xl border border-border bg-background p-3 text-sm"
        />
      </div>

      <div className="px-6 pb-6">
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

/* ---------- Wallet top-up ---------- */
function WalletTopup({
  balance,
  busy,
  onClose,
  onTopup,
}: {
  balance: number | null;
  busy: boolean;
  onClose: () => void;
  onTopup: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("200");
  const presets = [100, 200, 500];
  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= 10 && parsed <= 10000;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add money to wallet"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold tracking-tight">Add money</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-sm"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {balance != null ? `Current balance: ₹${balance}` : "Loading your balance…"}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className={`h-12 rounded-2xl border text-sm font-bold transition ${
                Number(amount) === p
                  ? "border-foreground bg-secondary text-secondary-foreground"
                  : "border-border bg-background"
              }`}
            >
              ₹{p}
            </button>
          ))}
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Custom amount (₹10 – ₹10,000)"
          className="mt-3 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-bold outline-none focus:border-foreground/40"
        />
        <button
          disabled={!valid || busy}
          onClick={() => onTopup(parsed)}
          className="mt-4 h-14 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "Adding…" : `Add ₹${valid ? parsed : 0}`}
        </button>
      </div>
    </div>
  );
}

/* ---------- Online payment (UPI / Card) ---------- */
function PaymentStep({
  rideId,
  method,
  fare,
  intent,
  onPaid,
  onRetry,
  onSwitch,
  onCancel,
}: {
  rideId: string;
  method: Payment;
  fare: number;
  intent: PaymentIntent;
  onPaid: () => void;
  onRetry: () => void;
  onSwitch: () => void;
  onCancel: () => void;
}) {
  const createOrderFn = useServerFn(createRazorpayPayment);
  const confirmFn = useServerFn(confirmRazorpayPayment);
  const [fallbackExpiry] = useState(() => new Date(Date.now() + 15 * 60 * 1000).toISOString());
  const expiresAt = intent.metadata?.expiresAt ?? fallbackExpiry;
  const [left, setLeft] = useState(() => secondsUntil(expiresAt));
  const [status, setStatus] = useState<PaymentStatus>("PENDING");
  const [busy, setBusy] = useState(false);
  const [rzBusy, setRzBusy] = useState(false);
  const paidLocallyRef = useRef(false);
  const expired = left <= 0 || status === "EXPIRED";

  useEffect(() => {
    const id = window.setInterval(() => setLeft(secondsUntil(expiresAt)), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  // Poll every 3s until paid; webhooks can be delayed, so keep checking.
  useEffect(() => {
    if (status === "PAID") return;
    let cancelled = false;
    const check = async () => {
      // A verified Razorpay payment decides the outcome; ignore backend lag.
      if (paidLocallyRef.current) return;
      try {
        const s = await paymentApi.forRide(rideId);
        if (cancelled) return;
        setStatus(s);
        if (s === "PAID") onPaid();
      } catch (e) {
        console.warn("Payment status check failed", e);
      }
    };
    void check();
    const id = window.setInterval(check, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId, expired, status]);

  // Pay through Razorpay test checkout (UPI / card / netbanking). On success
  // the signature is verified server-side before the ride proceeds.
  async function payWithRazorpay() {
    setRzBusy(true);
    try {
      const order = await createOrderFn({
        data: { amount: fare, description: `RIDEHER ride ${rideId}` },
      });
      if (!order.ok) throw new Error(order.error);
      let paid;
      try {
        paid = await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: order.amount,
          name: "RIDEHER",
          description: "Ride fare",
        });
      } catch (e) {
        if ((e as Error)?.message === RAZORPAY_CHECKOUT_DISMISSED) return;
        throw e;
      }
      const check = await confirmFn({
        data: {
          orderId: paid.razorpay_order_id,
          paymentId: paid.razorpay_payment_id,
          signature: paid.razorpay_signature,
          expectedAmount: order.amount,
        },
      });
      if (!check.ok) throw new Error(check.error);
      paidLocallyRef.current = true;
      setStatus("PAID");
      onPaid();
    } catch (e) {
      console.error("Razorpay payment failed", e);
      setStatus("FAILED");
    } finally {
      setRzBusy(false);
    }
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const qr = intent.metadata?.qrCode;
  const upi = intent.metadata?.upiIntent;
  const checkout = intent.metadata?.checkoutUrl;

  return (
    <>
      <div className="mb-4 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {method === "card" ? "Card payment" : "UPI payment"}
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Pay ₹{fare} to book</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          We'll find your captain as soon as payment is confirmed.
        </p>
      </div>

      {status === "FAILED" && !expired && (
        <div className="mx-6 mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold">
          Payment failed. Try again or pick another method.
        </div>
      )}

      {expired ? (
        <div className="mx-6 mb-6 rounded-2xl border border-border bg-muted p-5 text-center">
          <p className="text-base font-bold">Payment time ran out</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check your payment app for any debit. Payment confirmation may be delayed.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRetry();
                } finally {
                  setBusy(false);
                }
              }}
              className="h-12 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Retrying…" : "Retry"}
            </button>
            <button
              onClick={onSwitch}
              className="h-12 rounded-full border border-border bg-background text-sm font-bold"
            >
              Switch method
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-6 mb-6 rounded-2xl border border-border bg-card p-5 text-center">
          {qr ? (
            <img
              src={qr}
              alt="Scan to pay with any UPI app"
              className="mx-auto h-52 w-52 rounded-xl bg-background p-2"
            />
          ) : (
            <div className="mx-auto grid h-24 w-full max-w-[13rem] place-items-center rounded-xl bg-muted px-4 text-xs text-muted-foreground">
              Pay securely with UPI, card or netbanking below.
            </div>
          )}
          <p className="mt-3 font-mono text-xs font-bold" aria-live="polite">
            Expires in {mm}:{ss}
          </p>
          <div className="mt-4 grid gap-2">
            <button
              disabled={rzBusy || status === "PAID"}
              onClick={payWithRazorpay}
              className="grid h-12 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-60"
            >
              {rzBusy ? "Opening secure checkout…" : `Pay ₹${fare} with UPI / Card`}
            </button>
            {upi && (
              <a
                href={upi}
                className="grid h-12 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                Pay with UPI app
              </a>
            )}
            {checkout && method === "card" && (
              <a
                href={checkout}
                target="_blank"
                rel="noreferrer"
                className="grid h-12 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                Open card checkout
              </a>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Waiting for payment
            confirmation…
          </div>
        </div>
      )}

      <div className="px-6 pb-6">
        <button
          onClick={onCancel}
          className="h-12 w-full rounded-full border border-border bg-background text-sm font-bold"
        >
          Cancel booking
        </button>
      </div>
    </>
  );
}
