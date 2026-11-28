import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CancelAcceptedRide } from "@/components/rc/CancelAcceptedRide";
import {
  loadCustomerActiveRide,
  cancelRideConfirmed,
  cancelAcceptedRide,
  canApplyRideProgress,
} from "@/lib/booking";
import { authApi } from "@/lib/api";
import { RideSafety } from "@/components/rc/RideSafety";
import { RoleNav } from "@/components/rc/RoleNav";
import { RideMap } from "@/components/rc/RideMap";
import { NearbyCaptains } from "@/components/rc/NearbyCaptains";
import { LiveTrackingStatus } from "@/components/rc/LiveTrackingStatus";
import { mergeTrackingFix, trackingPhase, trackingIsFresh, trackingTarget, type TrackingFix } from "@/lib/live-tracking";
import { useTrackingRoute } from "@/lib/use-tracking-route";
import {
  canShowNearbyCaptains,
  isCaptainTracking,
  isMapPosition,
  mapVehicleType,
  normalizeNearbyAvailability,
  type MapVehicleType,
} from "@/lib/nearby-captains";
import type { PlaceResult } from "@/components/rc/PlaceSearch";
import { DestinationStep, VehicleStep, ConfirmStep, SearchingStep } from "@/components/rc/BookingSteps";
import { walletQueryKey } from "@/components/rc/WalletFunding";
import { PickupOtp, shouldShowPickupOtp } from "@/components/rc/PickupOtp";
import { RideRating } from "@/components/rc/RideRating";
import { RideCompletion } from "@/components/rc/RideCompletion";
import {
  RequestError,
  API_BASE_URL,
  api,
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
import {
  paymentApi,
  parseCreateRide,
  type PaymentIntent,
  type PaymentStatus,
  type PaymentConfiguration,
} from "@/lib/api";
import {
  needsOnlinePayment,
  isPaymentMethodAvailable,
  razorpayCheckoutDetails,
  razorpayConfirmation,
  toServerPayment,
} from "@/lib/payments";
import { RAZORPAY_CHECKOUT_DISMISSED, openRazorpayCheckout } from "@/lib/razorpay";

// Customer-only gate: this app is the customer section, so anyone not signed
// in is sent straight to the login page instead of an "account required" screen.
function CustomerGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let disposed = false;
    if (!storage.getAccessToken()) {
      navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
      return;
    }
    authApi
      .me()
      .then(({ user }) => {
        if (disposed) return;
        storage.saveUser(user);
        setSignedIn(true);
      })
      .catch(() => {
        if (disposed) return;
        // Session invalid or expired: go straight to login.
        navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
      });
    return () => {
      disposed = true;
    };
  }, [navigate]);

  if (signedIn) return children;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

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
    <CustomerGate>
      <RidePage />
    </CustomerGate>
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

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const coordinates = new URLSearchParams({ latitude: String(lat), longitude: String(lng) });
  try {
    const { formattedAddress } = await api<{ formattedAddress?: string }>(
      `/locations/reverse-geocode?${coordinates}`,
      { signal: AbortSignal.timeout(5000) },
    );
    const address = formattedAddress?.trim();
    if (address && address !== `${lat}, ${lng}`) return address;
  } catch {
    // Use Nominatim if the backend lookup fails.
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const result = (await res.json()) as { display_name?: string };
    return result.display_name?.trim() || null;
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
    vehicle_type: (details.vehicleType ?? ride.vehicleType).toLowerCase() as Ride["vehicle_type"],
    fare_inr: details.fareFinal ?? ride.fareFinal ?? details.fareEstimate ?? ride.fareEstimate,
    status: mapRideStatus(details.status ?? ride.status),
    // Keep the OTP returned at booking time while the matched-details poll is
    // in flight. It is deliberately not part of captain-facing responses.
    otp: details.otp ?? ride.otp ?? "",
    paymentMethod: details.paymentMethod ?? ride.paymentMethod,
    paymentStatus: details.paymentStatus ?? ride.paymentStatus,
    fareBreakdown: details.fareBreakdown,
    rating: details.rating,
    distanceMeters: details.distanceMeters ?? ride.distanceMeters,
    durationSeconds: details.durationSeconds ?? ride.durationSeconds,
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
  const [payment, setPayment] = useState<Payment>("cash");
  const gatewayQuery = useQuery({
    queryKey: ["payment-configuration", storage.getUser()?.id],
    queryFn: paymentApi.configuration,
    retry: 2,
    retryDelay: 1000,
    staleTime: 15000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: step === "confirm" ? 15000 : false,
  });
  const gateway = gatewayQuery.data ?? null;
  const walletQuery = useQuery({
    queryKey: walletQueryKey(),
    queryFn: walletApi.details,
    refetchInterval: step === "confirm" ? 15000 : false,
  });
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
        setSelected(restored.vehicle_type);
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
  const [captainPos, setCaptainPos] = useState<TrackingFix | null>(null);
  const [trackingNow, setTrackingNow] = useState(Date.now);
  const [trackingConnected, setTrackingConnected] = useState(false);
  const [creating, setCreating] = useState(false);
  const deviceIdRef = useRef<string>("");
  const userIdRef = useRef<string>("");
  const firstFixRef = useRef(false);
  const pickupLookupRef = useRef(0);

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
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [redispatching, setRedispatching] = useState(false);
  const awaitingPaymentRef = useRef(false);
  const paymentPickedRef = useRef(false);
  const idemKeyRef = useRef<string | null>(null);
  const stepRef = useRef<UiStep>("destination");
  const showNearby = canShowNearbyCaptains({ step, hasRide: !!ride, creating, recovering });
  const nearbyQuery = useQuery({
    queryKey: ["nearby-captains", storage.getUser()?.id, pickup.lat, pickup.lng],
    queryFn: async () =>
      normalizeNearbyAvailability((await captainMapApi.get(pickup.lat, pickup.lng)).data),
    enabled: showNearby && pickupConfirmed && !!storage.getAccessToken(),
    staleTime: 10000,
    refetchInterval: showNearby ? 10000 : false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: 1,
  });
  const [expiredNearbyAt, setExpiredNearbyAt] = useState(0);
  useEffect(() => {
    if (!showNearby || !nearbyQuery.dataUpdatedAt) return;
    const updatedAt = nearbyQuery.dataUpdatedAt;
    const timer = window.setTimeout(
      () => setExpiredNearbyAt(updatedAt),
      Math.max(0, updatedAt + 30000 - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [showNearby, nearbyQuery.dataUpdatedAt]);
  const nearby =
    showNearby &&
    pickupConfirmed &&
    !nearbyQuery.isError &&
    expiredNearbyAt !== nearbyQuery.dataUpdatedAt &&
    Date.now() - nearbyQuery.dataUpdatedAt < 30000
      ? nearbyQuery.data
      : undefined;
  const nearbyUnavailable =
    nearbyQuery.isError || (!nearby && nearbyQuery.dataUpdatedAt > 0 && !nearbyQuery.isFetching);
  const mapType = mapVehicleType(ride?.vehicle_type ?? selected);
  const nearbyCaptains = useMemo(
    () => nearby?.captains.filter((captain) => captain.vehicleType === mapType) ?? [],
    [nearby, mapType],
  );
  const trackingCaptain = !!ride && isCaptainTracking(step);
  const mapCaptain = trackingCaptain && isMapPosition(captainPos) ? captainPos : null;

  async function resolveCurrentPickup(position: { lat: number; lng: number }) {
    if (recoveredRideRef.current) return;
    firstFixRef.current = true;
    const lookup = ++pickupLookupRef.current;
    setLocating(false);
    setPickupConfirmed(false);
    setPickupQuery("");
    setPickup({ label: "Finding your pickup address?", ...position });

    const address = await reverseGeocode(position.lat, position.lng);
    if (lookup !== pickupLookupRef.current || recoveredRideRef.current) return;
    setPickup({ label: address ?? "Pickup address unavailable. Select Change to enter it.", ...position });
    setPickupConfirmed(Boolean(address));
  }

  function requestGeolocation(initial = false) {
    const lookup = pickupLookupRef.current;
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
        if (lookup !== pickupLookupRef.current || (initial && firstFixRef.current)) return;
        setGeoError(null);
        setLocating(false);
        void resolveCurrentPickup(p);
      },
      (err) => {
        if (lookup !== pickupLookupRef.current || (initial && firstFixRef.current)) return;
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

    requestGeolocation(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(p);
        setGeoError(null);
        if (!firstFixRef.current) void resolveCurrentPickup(p);
      },
      (err) => {
        if (firstFixRef.current) return;
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
    let fetching = false;
    let refreshAgain = false;
    let assignedCaptainId: string | null = null;
    const refreshBooking = async () => {
      if (disposed) return;
      if (fetching) { refreshAgain = true; return; }
      fetching = true;
      const requestedAt = Date.now();
      try {
        const response = await rideApi.bookingDetails(ride.id);
        if (disposed || cancellationRef.current) return;
        const updatedRide = toClientRide(response.data);
        const next = stepFromStatus(updatedRide.status);
        if (!canApplyRideProgress(stepRef.current, next)) return;
        // Some older API deployments omit the customer OTP from a later
        // booking-details response. Never let that refresh erase the OTP we
        // received when the customer created the ride or when it was matched.
        setRide((current) => ({
          ...updatedRide,
          otp: updatedRide.otp || current?.otp || "",
        }));
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
          if (!(prev === "rating" && next === "completed")) {
            stepRef.current = next;
            setStep(next);
          }
        }
        const nextCaptainId = response.data.captain?.id ?? null;
        const reassigned = assignedCaptainId !== null && assignedCaptainId !== nextCaptainId;
        assignedCaptainId = nextCaptainId;
        setCaptainPos((current) => nextCaptainId ? mergeTrackingFix(reassigned ? null : current, response.data.captainLocation, requestedAt) : null);
      } catch (error) {
        console.warn("Could not refresh ride booking details", error);
      } finally {
        fetching = false;
        if (refreshAgain && !disposed) { refreshAgain = false; void refreshBooking(); }
      }
    };

    socket.on(
      "ride:matched",
      (data: {
        rideId?: string;
        otp?: string;
        captain?: {
          id?: string;
          name?: string;
          phone?: string | null;
          avatarUrl?: string | null;
          vehicleModel?: string;
          vehicleType?: string;
          vehicleNumber?: string;
          rating?: number;
        };
        captainLocation?: { lat: number; lng: number; at?: string } | null;
      }) => {
        if (disposed || data.rideId !== ride.id || !canApplyRideProgress(stepRef.current, "matched")) return;
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
        const reassigned = assignedCaptainId !== null && assignedCaptainId !== data.captain?.id;
        assignedCaptainId = data.captain?.id ?? assignedCaptainId;
        setCaptainPos((current) => mergeTrackingFix(reassigned ? null : current, data.captainLocation));
        awaitingPaymentRef.current = false;
        setRedispatching(false);
        stepRef.current = "matched";
        setStep("matched");
        void refreshBooking();
      },
    );
    socket.on("captain:location", (data: { rideId?: string; captainId?: string; lat?: number; lng?: number; at?: string }) => {
      if (disposed || data.rideId !== ride.id || typeof data.lat !== "number" || typeof data.lng !== "number")
        return;
      if (!trackingPhase(stepRef.current) || (data.captainId && assignedCaptainId && data.captainId !== assignedCaptainId)) return;
      setCaptainPos((current) => mergeTrackingFix(current, data));
      setRide((current) =>
        current ? { ...current, captain_lat: data.lat, captain_lng: data.lng } : current,
      );
    });
    socket.on("ride:searching", (data: { rideId?: string }) => {
      if (disposed) return;
      if (data?.rideId && data.rideId !== ride.id) return;
      const prev = stepRef.current;
      if (prev === "matched" || prev === "arriving") {
        setRedispatching(true);
        setCaptainPos(null);
        assignedCaptainId = null;
        stepRef.current = "searching";
        setStep("searching");
      }
    });
    const refreshThisRide = (data: { rideId?: string }) => { if (data?.rideId === ride.id) void refreshBooking(); };
    socket.on("ride:arriving", refreshThisRide);
    socket.on("ride:started", refreshThisRide);
    socket.on("ride:completed", refreshThisRide);
    socket.on("payment:updated", refreshThisRide);
    socket.on("connect", () => { setTrackingConnected(true); void refreshBooking(); });
    socket.on("disconnect", () => setTrackingConnected(false));
    socket.io.on("reconnect_attempt", () => { socket.auth = { token: storage.getAccessToken() }; });
    socket.on("ride:cancelled", (data: { rideId?: string; status?: string }) => {
      if (!disposed && data.rideId === ride.id) {
        awaitingPaymentRef.current = false;
        setPaymentIntent(null);
        // Cancellation is terminal. Clear the active booking immediately so
        // the rider is not trapped on a stale matched/current-ride screen.
        setRide(null);
        setCaptainPos(null);
        stepRef.current = "destination";
        setStep("destination");
      }
    });

    // Socket delivery is immediate when available. Polling keeps the customer
    // portal in sync when Socket.IO is blocked by browser or deployment CORS.
    void refreshBooking();
    const pollId = window.setInterval(() => void refreshBooking(), 5000);
    const refresh = () => void refreshBooking();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      disposed = true;
      socket.removeAllListeners();
      socket.disconnect();
      setTrackingConnected(false);
      window.clearInterval(pollId);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [ride?.id]);

  const livePhase = trackingPhase(step);
  useEffect(() => {
    if (!livePhase) return;
    setTrackingNow(Date.now());
    const timer = window.setInterval(() => setTrackingNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [livePhase]);
  const liveRoute = useTrackingRoute({ rideId: ride?.id, phase: livePhase, fix: captainPos,
    target: trackingTarget(livePhase,
      { lat: ride?.pickup_lat ?? pickup.lat, lng: ride?.pickup_lng ?? pickup.lng },
      { lat: ride?.drop_lat ?? dest?.lat ?? pickup.lat, lng: ride?.drop_lng ?? dest?.lng ?? pickup.lng }),
    driving: ["auto", "cab"].includes(ride?.vehicle_type ?? selected) });

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
    if (!isPaymentMethodAvailable(payment, gateway, walletQuery.data?.balance ?? null, fare)) {
      void gatewayQuery.refetch();
      void walletQuery.refetch();
      return;
    }
    if (!storage.getAccessToken()) {
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    if (!pickupConfirmed) {
      alert("Confirm your pickup location before booking a ride.");
      setStep("destination");
      return;
    }
    // Same key on network retries so the server never books twice.
    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();
    setCreating(true);
    setCaptainPos(null);
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
            | "BIKE"
            | "AUTO"
            | "CAB",
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
      if (code === "INSUFFICIENT_WALLET_BALANCE") {
        void walletQuery.refetch();
        setQuoteAttempt((value) => value + 1);
      }
      try {
        const active = await loadCustomerActiveRide();
        if (
          active?.history.status === "SEARCHING" &&
          ["UPI", "CARD"].includes(active.history.paymentMethod ?? "")
        ) {
          setRide(toClientRide(active.details));
          setPayment(active.history.paymentMethod === "CARD" ? "card" : "upi");
          setPaymentIntent(active.history.paymentIntents?.[0] ?? {});
          awaitingPaymentRef.current = true;
          setStep("payment");
          return;
        }
      } catch {
        /* Preserve the original booking error if recovery is unavailable. */
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
    setPayment("cash");
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
    setCaptainPos(null);
    setStep("confirm");
  }

  function finishRating() {
    setRide(null);
    setDest(null);
    setDestQuery("");
    setEncodedPolyline("");
    setRouteSteps([]);
    setCaptainPos(null);
    setSelected("bike");
    setStep("destination");
  }

  const mapPickup = useMemo(() => ({ lat: ride?.pickup_lat ?? pickup.lat, lng: ride?.pickup_lng ?? pickup.lng }), [ride?.pickup_lat, ride?.pickup_lng, pickup.lat, pickup.lng]);
  const mapDrop = useMemo(() => ride
    ? { lat: ride.drop_lat, lng: ride.drop_lng }
    : dest ? { lat: dest.lat, lng: dest.lng }
    : { lat: pickup.lat + 0.03, lng: pickup.lng + 0.03 }, [ride?.drop_lat, ride?.drop_lng, dest?.lat, dest?.lng, pickup.lat, pickup.lng]);

  // Which polyline to draw: captain approach during matching/pickup, main route otherwise.
  const activePolyline = livePhase ? liveRoute?.encodedPolyline || (livePhase === "trip" ? encodedPolyline : "") : encodedPolyline;

  // Live ETA (in minutes) — haversine distance / assumed average speed.
  const etaTarget =
    step === "matched" || step === "arriving" ? mapPickup : step === "inprogress" ? mapDrop : null;
  const etaMinutes =
    captainPos && etaTarget && trackingIsFresh(captainPos, trackingNow)
      ? liveRoute?.durationSeconds ? Math.max(1, Math.ceil(liveRoute.durationSeconds / 60)) : computeEtaMinutes(captainPos, etaTarget, selected)
      : null;
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

  const postRide = ["completed", "rating", "cancelled"].includes(step);
  useEffect(() => {
    if (postRide) window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, postRide]);

  if (recovering || bookingError)
    return (
      <div className="flex min-h-screen flex-col bg-background p-8 text-center">
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
    <div className="flex min-h-dvh min-w-0 flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full min-w-0 max-w-[430px] flex-1 flex-col border-x border-border bg-background shadow-2xl">
        <div className="flex min-h-16 items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">

          {step !== "vehicle" && step !== "confirm" ? (
            <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
              RIDE<span className="text-primary">HER</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                if (step === "vehicle") setStep("destination");
                else if (step === "confirm") setStep("vehicle");
              }}
              className="grid h-11 w-11 place-items-center rounded-full border border-border text-sm disabled:opacity-40"
              aria-label="Back"
            >
              ←
            </button>
          )}
          <StepIndicator step={step} />
        </div>

        {/* Map area */}
        {!postRide && <div className={`relative shrink-0 overflow-hidden ${step === "destination" ? "h-[34dvh] min-h-[230px] max-h-[360px]" : step === "vehicle" || step === "confirm" ? "h-[30dvh] min-h-[200px] max-h-[320px]" : "h-[42dvh] min-h-[280px] max-h-[430px]"}`}>
          <RideMap
            pickup={mapPickup}
            drop={dest ? mapDrop : mapPickup}
            captain={mapCaptain}
            captainVehicleType={mapType}
            trackingPhase={livePhase}
            nearbyCaptains={nearbyCaptains}
            userLocation={userLocation}
            polyline={dest ? activePolyline : ""}
            routeLoading={routeLoading}
            routeError={routeError}
            fitKey={`${step}:${mapType}:${nearby ? "ready" : "pending"}`}
            recenterKey={recenterKey}
            recenterTarget={(trackingCaptain ? mapCaptain : userLocation) ?? mapPickup}
            className="absolute inset-0"
          />

          {livePhase && <LiveTrackingStatus phase={livePhase} fix={captainPos} now={trackingNow} connected={trackingConnected} />}
          {showNearby && (
            <NearbyCaptains
              type={mapType}
              count={nearby?.counts[mapType] ?? null}
              radiusKm={nearby?.radiusKm ?? 6}
              loading={nearbyQuery.isPending}
              failed={nearbyUnavailable}
              pickupConfirmed={pickupConfirmed}
              assigned={trackingCaptain}
              hasLocation={!!mapCaptain}
              onRetry={() => {
                void nearbyQuery.refetch();
              }}
            />
          )}

          {/* Recenter button */}
          <button
            type="button"
            onClick={() => {
              if ((trackingCaptain && mapCaptain) || userLocation) {
                setRecenterKey((k) => k + 1);
              } else {
                requestGeolocation();
              }
            }}
            aria-label={trackingCaptain ? "Recenter map on captain" : "Recenter map on my location"}
            className="absolute right-4 bottom-10 z-[1001] grid h-11 w-11 place-items-center rounded-full bg-card text-secondary shadow-lg ring-1 ring-black/10 transition hover:scale-105 active:scale-95"
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
            <div className="absolute inset-x-4 bottom-24 z-[1001] flex items-center gap-2 rounded-2xl bg-secondary/95 px-3 py-2 text-secondary-foreground shadow-lg ring-1 ring-black/10 backdrop-blur">
              <span className="text-xs font-semibold truncate">
                {geoError === "denied"
                  ? "Location off — set pickup manually"
                  : geoError === "timeout"
                    ? "Location timed out"
                    : "Location unavailable"}
              </span>
              <button
                onClick={() => requestGeolocation()}
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

          <div className="pointer-events-none absolute inset-x-4 top-28">
            {showTurnByTurn && currentStep && (
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
            )}
          </div>

          {etaLabel && etaMinutes !== null && (
            <div className="pointer-events-none absolute inset-x-16 bottom-10 flex justify-center">
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
        </div>}

        <section className={postRide ? "relative py-3" : "animate-sheet-up relative -mt-8 rounded-t-[32px] bg-card pt-4 shadow-[0_-20px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5"}>
          {!postRide && <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />}

          {step === "destination" && (
            <DestinationStep
              pickup={pickup}
              setPickup={(p) => {
                firstFixRef.current = true;
                pickupLookupRef.current++;
                setLocating(false);
                setPickup(p);
                setPickupQuery(p.label);
                setPickupConfirmed(true);
              }}
              pickupQuery={pickupQuery}
              setPickupQuery={setPickupQuery}
              onUseCurrentLocation={() => requestGeolocation()}
              locating={locating}
              pickupConfirmed={pickupConfirmed}
              dest={dest}
              setDest={setDest}
              query={destQuery}
              setQuery={setDestQuery}
              onNext={() => dest && pickupConfirmed && !locating && setStep("vehicle")}
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
              trip={{ pickup: pickup.label, drop: dest?.addr ?? "", routeInfo }}
              setSelected={setSelected}
              useSmartRoute={useSmartRoute}
              setUseSmartRoute={setUseSmartRoute}
              quotes={fareQuotes}
              availability={vehicleAvailability}
              nearbyCounts={nearby?.counts ?? null}
              nearbyLoading={nearbyQuery.isPending || nearbyQuery.isFetching}
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
              gateway={gateway}
              gatewayChecking={gatewayQuery.isFetching}
              gatewayFailed={gatewayQuery.isError}
              onRetryGateway={() => {
                void gatewayQuery.refetch();
              }}
              walletBalance={walletQuery.data?.balance ?? null}
              onNext={createRide}
              busy={
                creating ||
                recovering ||
                !!bookingError ||
                quotePending ||
                quoteError ||
                fareQuotes[selected as keyof typeof fareQuotes] == null
              }
              routeInfo={routeInfo}
              pickupLabel={pickup.label}
              dropLabel={dest?.addr ?? ""}
            />
          )}

          {step === "payment" && ride && paymentIntent && (
            <PaymentStep
              rideId={ride.id}
              method={payment}
              fare={ride.fare_inr}
              intent={paymentIntent}
              onPaid={onPaid}
              onRetry={retryPayment}
              onSwitch={switchPaymentMethod}
              onCancel={cancelDuringPayment}
            />
          )}

          {ride && shouldShowPickupOtp(step) && <PickupOtp otp={ride.otp} />}

          {step === "searching" && (
            <SearchingStep onCancel={cancelSearch} redispatching={redispatching} ride={ride} />
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
            <RideCompletion onRate={() => setStep("rating")} ride={ride} />
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
            <div className="px-4 pb-5"><RideRating
              key={ride.id}
              rideId={ride.id}
              captainName={ride.captain_name ?? "your captain"}
              initialRating={ride.rating}
              onSaved={rating => setRide(current => current?.id === ride.id ? { ...current, rating } : current)}
              onDone={finishRating}
            /></div>
          )}
        </section>
      </div>
      <RoleNav />
    </div>
  );
}

/* ---------- Step indicator ---------- */
function StepIndicator({ step }: { step: UiStep }) {
  const map: Record<UiStep, string> = {
    destination: "Plan your ride",
    vehicle: "Choose a ride",
    confirm: "Review & pay",
    payment: "Payment",
    searching: "Finding a captain",
    matched: "Captain on the way",
    arriving: "At pickup",
    inprogress: "On your way",
    completed: "Arrived",
    cancelled: "Cancelled",
    rating: "Rate your ride",
  };
  return (
    <span className="rounded-full bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
      {map[step]}
    </span>
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
  const [status, setStatus] = useState<PaymentStatus>(intent.status ?? "PENDING");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutIntent, setCheckoutIntent] = useState(intent);
  const paidRef = useRef(false);
  const busyRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const isTest = (checkoutIntent.mode ?? checkoutIntent.metadata?.mode) === "test";
  const amount = checkoutIntent.amount ?? checkoutIntent.metadata?.amount;
  const displayFare = amount != null ? amount / 100 : fare;

  function applyStatus(next: PaymentStatus) {
    setStatus(next);
    if (next === "PAID" && !paidRef.current) {
      paidRef.current = true;
      onPaidRef.current();
    }
  }
  useEffect(() => {
    let stopped = false,
      checking = false;
    let lastReconcile = Date.now();
    const poll = async () => {
      if (stopped || checking || paidRef.current || busyRef.current) return;
      checking = true;
      try {
        let next = await paymentApi.forRide(rideId);
        if (
          next === "PENDING" &&
          intent.providerIntentId?.startsWith("order_") &&
          Date.now() - lastReconcile >= 15000
        ) {
          lastReconcile = Date.now();
          next = await paymentApi.confirm({ rideId, providerIntentId: intent.providerIntentId });
        }
        if (!stopped) applyStatus(next);
      } catch {
        /* Retain the pending state; never infer success from a network failure. */
      } finally {
        checking = false;
      }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [rideId, intent.providerIntentId]);

  async function checkStatus() {
    setBusy(true);
    busyRef.current = true;
    setError("");
    try {
      const prepared = await paymentApi.prepare(rideId, method === "card" ? "CARD" : "UPI");
      setCheckoutIntent(prepared);
      const next = await paymentApi.confirm({
        rideId,
        providerIntentId: prepared.providerIntentId!,
      });
      applyStatus(next);
      if (next === "PENDING")
        setError("Payment is still pending. Check your payment app before retrying.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to verify payment. Please retry.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  async function payWithRazorpay() {
    if (busyRef.current) return;
    setBusy(true);
    busyRef.current = true;
    setError("");
    try {
      const prepared = await paymentApi.prepare(rideId, method === "card" ? "CARD" : "UPI");
      setCheckoutIntent(prepared);
      if (prepared.status === "PAID") {
        applyStatus("PAID");
        return;
      }
      const checkout = razorpayCheckoutDetails(prepared);
      const user = storage.getUser();
      const callback = await openRazorpayCheckout({
        ...checkout,
        name: "RideHer",
        description: checkout.mode === "test" ? "Test ride payment" : "Ride payment",
        prefill: {
          name: user?.name,
          email: user?.email ?? undefined,
          contact: user?.phone ?? undefined,
        },
      });
      const next = await paymentApi.confirm(
        razorpayConfirmation(rideId, checkout.orderId, callback),
      );
      applyStatus(next);
      if (next !== "PAID")
        setError("Your payment is being verified. We will continue when capture is confirmed.");
    } catch (error) {
      if (error instanceof Error && error.message === RAZORPAY_CHECKOUT_DISMISSED) return;
      setError(
        error instanceof Error
          ? error.message
          : "Unable to complete payment. Check payment status before retrying.",
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  return (
    <>
      <div className="mb-4 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Secure Razorpay checkout
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
          Pay ₹{displayFare.toFixed(2)} to book
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your captain request starts after the payment is verified.
        </p>
      </div>
      <div className="mx-6 mb-6 rounded-2xl border border-border bg-card p-5 space-y-4">
        {isTest && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
            Test payment: no real money is collected.
          </p>
        )}
        <p className="text-center text-sm">
          Pay using UPI, cards or other methods enabled for this Razorpay account.
        </p>
        <p className="text-center text-xs text-muted-foreground" role="status">
          Payment status: {status.toLowerCase()}
        </p>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {status === "REFUNDED" && (
          <p className="text-sm">
            This payment has been refunded. Choose another method to make a new booking.
          </p>
        )}
        <button
          disabled={busy || status === "PAID" || status === "REFUNDED"}
          onClick={payWithRazorpay}
          className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Please wait…" : `Pay ₹${displayFare.toFixed(2)}`}
        </button>
        <button
          disabled={busy || status === "REFUNDED"}
          onClick={checkStatus}
          className="h-12 w-full rounded-full border border-border text-sm font-bold disabled:opacity-60"
        >
          Check payment status
        </button>
        <p className="text-xs text-muted-foreground">
          Closing checkout does not create another booking. Retry uses the same payment order.
        </p>
      </div>
      <div className="grid gap-2 px-6 pb-6">
        <button
          disabled={busy}
          onClick={onSwitch}
          className="h-12 rounded-full border border-border bg-background text-sm font-bold disabled:opacity-60"
        >
          Change payment method
        </button>
        <button
          disabled={busy}
          onClick={onCancel}
          className="h-12 rounded-full border border-border bg-background text-sm font-bold disabled:opacity-60"
        >
          Cancel booking
        </button>
      </div>
    </>
  );
}
