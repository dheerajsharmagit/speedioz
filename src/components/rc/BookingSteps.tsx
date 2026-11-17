import { useState } from "react";
import { ArrowRight, ChevronDown, LocateFixed, MapPin, Wallet } from "lucide-react";
import { PlaceSearch, type PlaceResult } from "./PlaceSearch";
import { VehicleSymbol } from "./NearbyCaptains";
import { PaymentMethods } from "./PaymentMethods";
import { WalletFunding } from "./WalletFunding";
import { LegalConsent } from "@/components/legal/LegalPage";
import { isPaymentMethodAvailable, type ClientPayment } from "@/lib/payments";
import type { PaymentConfiguration, VehicleTypeId } from "@/lib/api";
import type { MapVehicleType } from "@/lib/nearby-captains";
import type { Ride } from "@/lib/rides";

type Pickup = { label: string; lat: number; lng: number };
type RouteInfo = { distanceMeters: number; durationSeconds: number } | null;
type Vehicle = { id: string; name: string };
const vehicleOptions = [
  { id: "bike", name: "Bike", type: "BIKE" },
  { id: "auto", name: "Auto", type: "AUTO" },
  { id: "cab", name: "Cab", type: "CAB" },
] as const;
const buttonClass =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-bold text-secondary transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50";
const distance = (meters: number) =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
const duration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} hr ${minutes % 60 ? `${minutes % 60} min` : ""}`;
};

function Heading({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function TripDetails({
  pickup,
  drop,
  routeInfo = null,
}: {
  pickup: string;
  drop: string;
  routeInfo?: RouteInfo;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-background/50">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <MapPin className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          Trip details
          {routeInfo && routeInfo.distanceMeters > 0
            ? ` · ${distance(routeInfo.distanceMeters)} · ${duration(routeInfo.durationSeconds)}`
            : ""}
        </span>
        <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">
        {[
          { label: "Pickup", value: pickup, color: "bg-success" },
          { label: "Destination", value: drop, color: "bg-primary" },
        ].map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${item.color}`} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function DestinationStep({
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
  setPickup: (value: Pickup) => void;
  pickupQuery: string;
  setPickupQuery: (value: string) => void;
  onUseCurrentLocation: () => void;
  locating: boolean;
  pickupConfirmed: boolean;
  dest: PlaceResult | null;
  setDest: (value: PlaceResult | null) => void;
  query: string;
  setQuery: (value: string) => void;
  onNext: () => void;
  routeInfo: RouteInfo;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-5 px-5 pb-6">
      <Heading title="Where are we going?">Set your pickup, then choose a destination.</Heading>
      <section
        aria-label="Journey locations"
        className="space-y-4 rounded-2xl border border-border p-4"
      >
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="size-2 rounded-full bg-success" />
              Pickup
            </h3>
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="min-h-8 text-xs font-semibold text-primary"
            >
              {editing ? "Done" : "Change"}
            </button>
          </div>
          {editing ? (
            <div className="space-y-2">
              <PlaceSearch
                value={pickupQuery}
                onChange={setPickupQuery}
                onSelect={(place) => {
                  setPickup({ label: place.addr, lat: place.lat, lng: place.lng });
                  setPickupQuery(place.addr);
                  setEditing(false);
                }}
                placeholder="Search pickup location"
                bias={pickup}
              />
              <button
                type="button"
                onClick={() => {
                  onUseCurrentLocation();
                  setEditing(false);
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
              >
                <LocateFixed className="size-4" />
                Use current location
              </button>
            </div>
          ) : (
            <p className="break-words text-sm font-medium leading-relaxed [overflow-wrap:anywhere]">
              {locating ? "Finding your location…" : pickup.label}
            </p>
          )}
        </div>
        <div className="border-t border-border pt-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            Destination
          </h3>
          <PlaceSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              if (dest && value !== dest.addr) setDest(null);
            }}
            onSelect={(place) => {
              setDest(place);
              setQuery(place.addr);
            }}
            placeholder="Where would you like to go?"
            bias={pickup}
          />
        </div>
      </section>
      {dest && routeInfo && routeInfo.distanceMeters > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{distance(routeInfo.distanceMeters)}</span>
          <span>About {duration(routeInfo.durationSeconds)}</span>
        </p>
      )}
      <button
        type="button"
        disabled={!dest || !pickupConfirmed}
        onClick={onNext}
        className={buttonClass}
      >
        {pickupConfirmed ? "See available rides" : "Set your pickup to continue"}
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

export function VehicleStep({
  selected,
  setSelected,
  quotes,
  availability,
  nearbyCounts,
  nearbyLoading,
  onNext,
  trip,
}: {
  selected: string;
  setSelected: (value: string) => void;
  useSmartRoute: boolean;
  setUseSmartRoute: (value: boolean) => void;
  quotes: Partial<Record<"bike" | "auto" | "ev" | "cab", number>>;
  availability: Partial<Record<VehicleTypeId, boolean>>;
  nearbyCounts: Record<MapVehicleType, number> | null;
  nearbyLoading: boolean;
  onNext: () => void;
  trip?: { pickup: string; drop: string; routeInfo: RouteInfo };
}) {
  return (
    <div className="space-y-5 px-5 pb-6">
      <Heading title="Choose your ride">
        Nearby captains and fares for your route.
      </Heading>
      {trip && <TripDetails {...trip} />}
      <section aria-label="Vehicle options" className="space-y-2">
        {vehicleOptions.map((vehicle) => {
          const active = selected === vehicle.id,
            price = quotes[vehicle.id];
          const unavailable = availability[vehicle.type] === false || price == null;
          const count = nearbyCounts?.[vehicle.type];
          return (
            <button
              key={vehicle.id}
              type="button"
              disabled={unavailable}
              aria-pressed={active}
              onClick={() => setSelected(vehicle.id)}
              className={`flex min-h-20 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card"}`}
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-xl ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                <VehicleSymbol type={vehicle.type} className="size-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">{vehicle.name}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {unavailable
                    ? "Currently unavailable"
                    : count != null
                      ? `${count} captain${count === 1 ? "" : "s"} nearby`
                      : nearbyLoading
                        ? "Checking nearby captains…"
                        : "Availability updates live"}
                </span>
              </span>
              <span className="shrink-0 text-lg font-bold">{unavailable ? "—" : `₹${price}`}</span>
              <span
                aria-hidden
                className={`grid size-4 shrink-0 place-items-center rounded-full border ${active ? "border-primary" : "border-muted-foreground/40"}`}
              >
                {active && <span className="size-2 rounded-full bg-primary" />}
              </span>
            </button>
          );
        })}
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Estimated fares. Final charges depend on your trip.
      </p>
      <button
        type="button"
        disabled={quotes[selected as keyof typeof quotes] == null}
        onClick={onNext}
        className={buttonClass}
      >
        Continue with{" "}
        {vehicleOptions.find((vehicle) => vehicle.id === selected)?.name || "your ride"}
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

export function ConfirmStep({
  vehicle,
  fare,
  payment,
  setPayment,
  onNext,
  busy,
  routeInfo,
  pickupLabel,
  dropLabel,
  gateway,
  gatewayChecking,
  gatewayFailed,
  onRetryGateway,
  walletBalance,
}: {
  vehicle: Vehicle;
  fare: number;
  useSmartRoute: boolean;
  smartSavings: number;
  payment: ClientPayment;
  setPayment: (value: ClientPayment) => void;
  onNext: () => void;
  busy: boolean;
  routeInfo: RouteInfo;
  pickupLabel: string;
  dropLabel: string;
  gateway: PaymentConfiguration | null;
  gatewayChecking: boolean;
  gatewayFailed: boolean;
  onRetryGateway: () => void;
  walletBalance: number | null;
}) {
  const shortfall =
    payment === "wallet" && walletBalance !== null ? Math.max(0, fare - walletBalance) : 0;
  return (
    <div className="space-y-5 px-5 pb-6">
      <Heading title="Review & pay">One last check before we find your captain.</Heading>
      <section
        aria-label="Fare summary"
        className="flex items-center gap-3 rounded-2xl border border-border p-4"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <VehicleSymbol
            type={vehicle.id === "auto" ? "AUTO" : vehicle.id === "cab" ? "CAB" : "BIKE"}
            className="size-7"
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{vehicle.name}</h3>
          <p className="text-xs text-muted-foreground">Estimated total fare</p>
        </div>
        <p className="shrink-0 text-2xl font-bold">₹{fare}</p>
      </section>
      <TripDetails pickup={pickupLabel} drop={dropLabel} routeInfo={routeInfo} />
      <PaymentMethods
        payment={payment}
        onChange={setPayment}
        configuration={gateway}
        checking={gatewayChecking}
        failed={gatewayFailed}
        onRetry={onRetryGateway}
        walletBalance={walletBalance}
      />
      {payment === "wallet" && (
        <details
          className="group rounded-2xl border border-border"
          open={shortfall > 0 || undefined}
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <Wallet className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              {shortfall > 0
                ? `Add ₹${shortfall.toFixed(2)} to book this ride`
                : "Add money to your wallet"}
            </span>
            <ChevronDown className="size-4 shrink-0 group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3">
            <WalletFunding requiredFare={fare} />
          </div>
        </details>
      )}
      <div className="space-y-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={busy || !isPaymentMethodAvailable(payment, gateway, walletBalance, fare)}
          className={buttonClass}
        >
          {busy ? "Requesting your ride…" : `Book ${vehicle.name}`}
          <ArrowRight className="size-4" />
        </button>
        <LegalConsent action="booking a ride" />
      </div>
    </div>
  );
}

export function SearchingStep({
  onCancel,
  redispatching,
  ride,
}: {
  onCancel: () => void;
  redispatching?: boolean;
  ride: Ride | null;
}) {
  return (
    <div className="space-y-5 px-5 pb-6">
      <div role="status" aria-live="polite">
        <Heading title={redispatching ? "Finding another captain" : "Finding your captain"}>
          {redispatching
            ? "We're looking for another available captain nearby."
            : "Your request is with nearby captains. We'll let you know when one accepts."}
        </Heading>
      </div>
      <div
        role="progressbar"
        aria-label="Finding an available captain"
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
      </div>
      {ride && (
        <>
          <section
            aria-label="Booked fare"
            className="flex items-center gap-3 rounded-2xl border border-border p-4"
          >
            <VehicleSymbol
              type={
                ride.vehicle_type === "auto" ? "AUTO" : ride.vehicle_type === "cab" ? "CAB" : "BIKE"
              }
              className="size-8 shrink-0 text-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold capitalize">{ride.vehicle_type} ride</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ride.paymentMethod === "WALLET"
                  ? "Paid with RideHer wallet"
                  : ride.paymentMethod === "CASH"
                    ? "Pay at the destination"
                    : "Online payment"}
              </p>
            </div>
            <p className="shrink-0 text-xl font-bold">₹{ride.fare_inr}</p>
          </section>
          <TripDetails pickup={ride.pickup_label} drop={ride.drop_label} />
        </>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold"
      >
        Cancel search
      </button>
    </div>
  );
}
