import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import mapCity from "@/assets/map-city.jpg";
import { RoleNav } from "@/components/rc/RoleNav";

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

const recents = [
  { name: "Home", addr: "Indiranagar, 100 Ft Rd" },
  { name: "Office", addr: "Manyata Tech Park, Gate 3" },
  { name: "Airport", addr: "Kempegowda International" },
];

const suggestions = [
  { name: "Phoenix Marketplace", addr: "Whitefield Main Rd", tag: "Popular" },
  { name: "MG Road Metro", addr: "Trinity Circle", tag: "Nearby" },
  { name: "Cubbon Park", addr: "Kasturba Rd Entrance", tag: "Nearby" },
  { name: "Koramangala 5th Block", addr: "80 Ft Rd", tag: "Popular" },
];

type Step =
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

const captain = {
  name: "Rajesh K.",
  rating: 4.9,
  trips: 3421,
  plate: "KA·05·MH·4421",
  vehicleName: "Honda Activa · Yellow",
  otp: "4729",
  phone: "+91 98•••••42",
};

function RidePage() {
  const [step, setStep] = useState<Step>("destination");
  const [selected, setSelected] = useState("bike");
  const [dest, setDest] = useState("");
  const [pickup] = useState("Studio 14, Arts District");
  const [payment, setPayment] = useState<Payment>("upi");
  const [useSmartRoute, setUseSmartRoute] = useState(true);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);

  const vehicle = useMemo(() => vehicles.find((v) => v.id === selected)!, [selected]);
  const fare = vehicle.price + (useSmartRoute ? 0 : 8);
  const smartSavings = 12;

  // Auto-advance searching -> matched
  useEffect(() => {
    if (step !== "searching") return;
    const t = setTimeout(() => setStep("matched"), 2400);
    return () => clearTimeout(t);
  }, [step]);

  // Auto-advance matched -> arriving
  useEffect(() => {
    if (step !== "matched") return;
    const t = setTimeout(() => setStep("arriving"), 2200);
    return () => clearTimeout(t);
  }, [step]);

  const reset = () => {
    setStep("destination");
    setDest("");
    setRating(0);
    setTip(0);
    setSelected("bike");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RoleNav />
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col border-x border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          {step === "destination" ? (
            <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
              RideConnect<span className="text-primary">.</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                const back: Record<Step, Step> = {
                  destination: "destination",
                  vehicle: "destination",
                  confirm: "vehicle",
                  searching: "confirm",
                  matched: "searching",
                  arriving: "matched",
                  inprogress: "arriving",
                  completed: "inprogress",
                  rating: "completed",
                };
                setStep(back[step]);
              }}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-sm"
              aria-label="Back"
            >
              ←
            </button>
          )}
          <StepIndicator step={step} />
        </div>

        {/* Map area */}
        <div className="relative flex-1 overflow-hidden">
          <img src={mapCity} alt="Map" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />

          <div className="absolute left-6 top-6 rounded-2xl bg-card/95 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Pickup from</p>
            <p className="mt-1 text-xs font-semibold">{pickup}</p>
            {dest && step !== "destination" && (
              <>
                <div className="my-2 h-px bg-border" />
                <p className="font-mono text-[10px] uppercase text-muted-foreground">Drop</p>
                <p className="mt-1 text-xs font-semibold">{dest}</p>
              </>
            )}
          </div>

          {step === "searching" && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="relative h-32 w-32">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                <div className="absolute inset-4 animate-ping rounded-full bg-primary/60" style={{ animationDelay: "0.3s" }} />
                <div className="absolute inset-10 rounded-full bg-primary shadow-xl" />
              </div>
            </div>
          )}

          {(step === "matched" || step === "arriving" || step === "inprogress") && (
            <>
              <div className="absolute left-1/3 top-1/2 h-3 w-3 rounded-full bg-primary shadow-lg ring-4 ring-primary/30" />
              <div className="absolute right-1/4 top-2/3 h-3 w-3 rounded-full bg-secondary shadow-lg ring-4 ring-secondary/20" />
            </>
          )}
        </div>

        {/* Bottom sheet */}
        <section className="animate-sheet-up relative -mt-8 rounded-t-[32px] bg-card pt-4 shadow-[0_-20px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-muted" />

          {step === "destination" && (
            <DestinationStep
              dest={dest}
              setDest={setDest}
              onNext={() => dest.trim() && setStep("vehicle")}
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
              onNext={() => setStep("searching")}
            />
          )}

          {step === "searching" && <SearchingStep onCancel={() => setStep("confirm")} />}

          {step === "matched" && <MatchedStep />}

          {step === "arriving" && (
            <RideStatusStep
              title="Captain arriving"
              subtitle={`${captain.name} is 2 min away`}
              onNext={() => setStep("inprogress")}
              ctaLabel="Simulate pickup"
            />
          )}

          {step === "inprogress" && (
            <RideStatusStep
              title="On the way"
              subtitle="22 min via Smart Route · saving 12 min"
              onNext={() => setStep("completed")}
              ctaLabel="Simulate arrival"
            />
          )}

          {step === "completed" && (
            <CompletedStep fare={fare} onNext={() => setStep("rating")} />
          )}

          {step === "rating" && (
            <RatingStep
              rating={rating}
              setRating={setRating}
              tip={tip}
              setTip={setTip}
              onDone={reset}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- Step indicator ---------- */
function StepIndicator({ step }: { step: Step }) {
  const map: Record<Step, string> = {
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
  dest: string;
  setDest: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="mb-4 px-6">
        <div className="relative">
          <div className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            type="text"
            placeholder="Where to?"
            className="h-16 w-full rounded-2xl bg-muted pl-10 pr-4 text-lg font-semibold outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {recents.map((r) => (
            <button
              key={r.name}
              onClick={() => setDest(r.addr)}
              className="flex-none rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold"
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 px-6">
        <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Suggested nearby
        </p>
        <div className="space-y-2">
          {suggestions.map((s) => (
            <button
              key={s.name}
              onClick={() => setDest(s.addr)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left transition hover:border-foreground/30"
            >
              <div>
                <p className="text-sm font-bold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.addr}</p>
              </div>
              <span className="rounded-full bg-muted px-2 py-1 font-mono text-[9px] font-bold uppercase">
                {s.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-12">
        <button
          disabled={!dest.trim()}
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
  selected,
  setSelected,
  useSmartRoute,
  setUseSmartRoute,
  onNext,
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
  vehicle,
  fare,
  useSmartRoute,
  smartSavings,
  payment,
  setPayment,
  onNext,
}: {
  vehicle: Vehicle;
  fare: number;
  useSmartRoute: boolean;
  smartSavings: number;
  payment: Payment;
  setPayment: (p: Payment) => void;
  onNext: () => void;
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
            <Row label="Smart Route" value={useSmartRoute ? `−₹${smartSavings}` : "—"} accent={useSmartRoute} />
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
                <p className={`mt-1 text-[10px] ${active ? "text-secondary-foreground/60" : "text-muted-foreground"}`}>
                  {m.sub}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 pb-12">
        <button
          onClick={onNext}
          className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95"
        >
          Book · ₹{fare}
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
            <p className="text-xs font-semibold">3 captains within 500m</p>
          </div>
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
function MatchedStep() {
  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Captain matched</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{captain.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ★ {captain.rating} · {captain.trips.toLocaleString()} trips
        </p>
      </div>

      <div className="mb-6 px-6">
        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Vehicle</p>
              <p className="mt-1 text-sm font-bold">{captain.vehicleName}</p>
            </div>
            <p className="rounded-full bg-primary px-3 py-1 font-mono text-xs font-bold text-secondary">
              {captain.plate}
            </p>
          </div>
          <div className="my-3 h-px bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Share OTP on pickup</p>
              <div className="mt-2 flex gap-2">
                {captain.otp.split("").map((d, i) => (
                  <span key={i} className="grid h-11 w-9 place-items-center rounded-lg bg-secondary text-lg font-extrabold text-primary">
                    {d}
                  </span>
                ))}
              </div>
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

/* ---------- Generic in-ride status ---------- */
function RideStatusStep({
  title,
  subtitle,
  onNext,
  ctaLabel,
}: {
  title: string;
  subtitle: string;
  onNext: () => void;
  ctaLabel: string;
}) {
  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Live</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mb-6 px-6">
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-secondary-foreground">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary font-bold text-secondary">R</div>
          <div className="flex-1">
            <p className="text-sm font-bold">{captain.name}</p>
            <p className="text-[10px] text-secondary-foreground/60">{captain.plate}</p>
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

/* ---------- Completed ---------- */
function CompletedStep({ fare, onNext }: { fare: number; onNext: () => void }) {
  return (
    <>
      <div className="mb-4 px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Arrived</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">You've reached</h2>
      </div>

      <div className="mb-6 px-6">
        <div className="rounded-2xl border border-border p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold">Total paid</p>
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
  rating,
  setRating,
  tip,
  setTip,
  onDone,
}: {
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
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Rate {captain.name}</h2>
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
