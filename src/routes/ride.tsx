import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoleNav } from "@/components/rc/RoleNav";
import { RideMap } from "@/components/rc/RideMap";
import { supabase } from "@/integrations/supabase/client";
import { computeRoute } from "@/lib/routes.functions";
import { getDeviceId } from "@/lib/device-id";
import { ensureAnonSession } from "@/lib/anon-session";
import { decodePolyline, pointAt } from "@/lib/polyline";
import { generateOtp, type Ride, type RideStatus } from "@/lib/rides";

export const Route = createFileRoute("/ride")({
  head: () => ({
    meta: [
      { title: "Book a ride — RideConnect AI" },
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

// Bangalore-area presets
const PICKUP = { label: "Studio 14, Arts District (Indiranagar)", lat: 12.9718, lng: 77.6412 };
const DESTS = [
  { name: "Home", addr: "Indiranagar, 100 Ft Rd", lat: 12.9784, lng: 77.6408 },
  { name: "Office", addr: "Manyata Tech Park", lat: 13.0450, lng: 77.6210 },
  { name: "Airport", addr: "Kempegowda Intl Airport", lat: 13.1986, lng: 77.7066 },
  { name: "Phoenix Marketplace", addr: "Whitefield Main Rd", lat: 12.9955, lng: 77.6960 },
  { name: "MG Road Metro", addr: "Trinity Circle", lat: 12.9755, lng: 77.6060 },
  { name: "Cubbon Park", addr: "Kasturba Rd", lat: 12.9767, lng: 77.5946 },
  { name: "Koramangala 5th Block", addr: "80 Ft Rd", lat: 12.9352, lng: 77.6245 },
];

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
    default: return "searching";
  }
}

function RidePage() {
  const [step, setStep] = useState<UiStep>("destination");
  const [selected, setSelected] = useState("bike");
  const [dest, setDest] = useState<typeof DESTS[number] | null>(null);
  const [payment, setPayment] = useState<Payment>("upi");
  const [useSmartRoute, setUseSmartRoute] = useState(true);
  const [ride, setRide] = useState<Ride | null>(null);
  const [encodedPolyline, setEncodedPolyline] = useState<string>("");
  const [captainPos, setCaptainPos] = useState<{ lat: number; lng: number } | null>(null);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [creating, setCreating] = useState(false);
  const deviceIdRef = useRef<string>("");

  useEffect(() => { deviceIdRef.current = getDeviceId(); }, []);

  const vehicle = useMemo(() => vehicles.find((v) => v.id === selected)!, [selected]);
  const fare = vehicle.price + (useSmartRoute ? 0 : 8);
  const smartSavings = 12;

  // Subscribe to this ride's lifecycle
  useEffect(() => {
    if (!ride) return;
    const channel = supabase
      .channel(`ride-${ride.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${ride.id}` },
        (payload) => {
          const next = payload.new as Ride;
          setRide(next);
          setStep(stepFromStatus(next.status as RideStatus));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_locations", filter: `ride_id=eq.${ride.id}` },
        (payload) => {
          const row = payload.new as { lat: number; lng: number };
          setCaptainPos({ lat: row.lat, lng: row.lng });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ride?.id]);

  // Compute polyline when destination is picked
  useEffect(() => {
    if (!dest) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await computeRoute({
          data: {
            origin: { lat: PICKUP.lat, lng: PICKUP.lng },
            destination: { lat: dest.lat, lng: dest.lng },
            travelMode: selected === "auto" ? "DRIVE" : "TWO_WHEELER",
          },
        });
        if (!cancelled) setEncodedPolyline(res.encodedPolyline);
      } catch (e) {
        console.warn("route fetch failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [dest, selected]);

  async function createRide() {
    if (!dest) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .insert({
          rider_device_id: deviceIdRef.current,
          pickup_label: PICKUP.label,
          pickup_lat: PICKUP.lat,
          pickup_lng: PICKUP.lng,
          drop_label: dest.addr,
          drop_lat: dest.lat,
          drop_lng: dest.lng,
          vehicle_type: selected,
          fare_inr: fare,
          otp: generateOtp(),
          use_smart_route: useSmartRoute,
          smart_route_savings_min: useSmartRoute ? smartSavings : 0,
          payment_method: payment,
          status: "searching",
        })
        .select()
        .single();
      if (error) throw error;
      setRide(data as Ride);
      setStep("searching");
    } catch (e) {
      console.error(e);
      alert("Couldn't create ride. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function cancelSearch() {
    if (ride) {
      await supabase.from("rides").update({ status: "cancelled" }).eq("id", ride.id);
    }
    setRide(null);
    setEncodedPolyline("");
    setCaptainPos(null);
    setStep("confirm");
  }

  async function simulateArrivalAtPickup() {
    if (!ride) return;
    await supabase.from("rides").update({ status: "in_progress" }).eq("id", ride.id);
  }
  async function simulateCompleted() {
    if (!ride) return;
    await supabase.from("rides").update({ status: "completed" }).eq("id", ride.id);
  }
  async function submitRating() {
    if (!ride) return;
    await supabase.from("rides").update({ status: "rated", rating, tip_inr: tip }).eq("id", ride.id);
    // reset
    setRide(null);
    setDest(null);
    setEncodedPolyline("");
    setCaptainPos(null);
    setRating(0);
    setTip(0);
    setSelected("bike");
    setStep("destination");
  }

  const mapPickup = { lat: PICKUP.lat, lng: PICKUP.lng };
  const mapDrop = dest ? { lat: dest.lat, lng: dest.lng } : { lat: PICKUP.lat + 0.03, lng: PICKUP.lng + 0.03 };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RoleNav />
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col border-x border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          {step === "destination" ? (
            <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
              RideConnect<span className="text-primary">.</span>
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
        <div className="relative flex-1 overflow-hidden">
          {dest ? (
            <RideMap
              pickup={mapPickup}
              drop={mapDrop}
              captain={captainPos}
              polyline={encodedPolyline}
              className="h-full w-full"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-muted">
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Live map</p>
                <p className="mt-2 text-sm font-bold">Pick a destination to preview your route</p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute left-6 right-6 top-6">
            <div className="rounded-2xl bg-card/95 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Pickup from</p>
              <p className="mt-1 text-xs font-semibold">{PICKUP.label}</p>
              {dest && (
                <>
                  <div className="my-2 h-px bg-border" />
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">Drop</p>
                  <p className="mt-1 text-xs font-semibold">{dest.addr}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom sheet */}
        <section className="animate-sheet-up relative -mt-8 rounded-t-[32px] bg-card pt-4 shadow-[0_-20px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-muted" />

          {step === "destination" && (
            <DestinationStep dest={dest} setDest={setDest} onNext={() => dest && setStep("vehicle")} />
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
            />
          )}

          {step === "searching" && <SearchingStep onCancel={cancelSearch} />}

          {step === "matched" && ride && <MatchedStep ride={ride} />}

          {step === "arriving" && ride && (
            <RideStatusStep
              title="Captain arriving"
              subtitle={ride.captain_name ? `${ride.captain_name} is on the way` : "On the way"}
              ride={ride}
              onNext={simulateArrivalAtPickup}
              ctaLabel="Simulate pickup"
            />
          )}

          {step === "inprogress" && ride && (
            <RideStatusStep
              title="On the way"
              subtitle={`22 min via Smart Route${useSmartRoute ? " · saving 12 min" : ""}`}
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
  dest,
  setDest,
  onNext,
}: {
  dest: typeof DESTS[number] | null;
  setDest: (v: typeof DESTS[number]) => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="mb-4 px-6">
        <div className="relative">
          <div className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
          <input
            value={dest?.addr ?? ""}
            readOnly
            placeholder="Pick a destination below"
            className="h-16 w-full rounded-2xl bg-muted pl-10 pr-4 text-lg font-semibold outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="mb-6 px-6">
        <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Popular destinations</p>
        <div className="space-y-2">
          {DESTS.map((d) => {
            const active = dest?.addr === d.addr;
            return (
              <button
                key={d.addr}
                onClick={() => setDest(d)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  active ? "border-foreground bg-secondary text-secondary-foreground" : "border-border bg-background hover:border-foreground/30"
                }`}
              >
                <div>
                  <p className="text-sm font-bold">{d.name}</p>
                  <p className={`text-xs ${active ? "text-secondary-foreground/60" : "text-muted-foreground"}`}>{d.addr}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

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
  vehicle, fare, useSmartRoute, smartSavings, payment, setPayment, onNext, busy,
}: {
  vehicle: Vehicle;
  fare: number;
  useSmartRoute: boolean;
  smartSavings: number;
  payment: Payment;
  setPayment: (p: Payment) => void;
  onNext: () => void;
  busy: boolean;
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
              {ride.otp.split("").map((d, i) => (
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
      await supabase.from("ride_locations").insert({ ride_id: ride.id, lat: pos.lat, lng: pos.lng });
      if (i >= steps) {
        clearInterval(t);
        await supabase.from("rides").update({ status: "arriving" }).eq("id", ride.id);
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
          await supabase.from("ride_locations").insert({ ride_id: ride.id, lat: pos.lat, lng: pos.lng });
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
