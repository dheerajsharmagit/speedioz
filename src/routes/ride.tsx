import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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

function RidePage() {
  const [selected, setSelected] = useState("bike");
  const [dest, setDest] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RoleNav />
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col border-x border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
            RideConnect<span className="text-primary">.</span>
          </Link>
          <div className="grid h-9 w-9 place-items-center rounded-full border border-border">
            <div className="h-1.5 w-1.5 rounded-full bg-foreground" />
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <img src={mapCity} alt="Map" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />

          <div className="absolute left-6 top-6 rounded-2xl bg-card/95 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Pickup from</p>
            <p className="mt-1 text-xs font-semibold">Studio 14, Arts District</p>
          </div>

          <div className="absolute left-1/3 top-1/2 h-3 w-3 rounded-full bg-primary">
            <div className="animate-pulse-slow absolute inset-0 rounded-full bg-primary" />
          </div>
          <div className="absolute right-1/4 top-2/3 h-3 w-3 rounded-full bg-primary">
            <div className="animate-pulse-slow absolute inset-0 rounded-full bg-primary" style={{ animationDelay: "0.7s" }} />
          </div>
        </div>

        <section className="animate-sheet-up relative -mt-8 rounded-t-[32px] bg-card pt-4 shadow-[0_-20px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-muted" />

          <div className="mb-6 px-6">
            <div className="relative">
              <div className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
              <input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                type="text"
                placeholder="Where to?"
                className="h-16 w-full rounded-2xl bg-muted pl-10 pr-4 text-lg font-semibold outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
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
            <div className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground">
              <div className="shimmer-line absolute inset-0 opacity-10" />
              <div className="relative z-10">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <span className="mb-2 inline-block rounded bg-accent/20 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                      Community Route
                    </span>
                    <h3 className="text-xl font-bold leading-tight">Save 12 min</h3>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase text-secondary-foreground/50">Verified by</p>
                    <p className="text-sm font-bold">47 Captains</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-secondary-foreground/50">Regular</p>
                    <p className="text-sm line-through opacity-50">34 mins</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-accent">Smart AI</p>
                    <p className="text-sm font-bold">22 mins</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-12">
            <button className="h-16 w-full rounded-full bg-primary text-lg font-bold text-secondary shadow-xl transition-transform active:scale-95">
              Confirm Ride · ₹{vehicles.find((v) => v.id === selected)?.price}
            </button>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              OTP shared with captain on pickup
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
