import { createFileRoute, Link } from "@tanstack/react-router";
import mapHero from "@/assets/map-hero.jpg";
import { RoleNav } from "@/components/rc/RoleNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RideConnect AI — Ride Smarter. Reach Faster." },
      { name: "description", content: "Bike & auto ride booking powered by community-verified smart routes. Save 12 min on average." },
    ],
  }),
  component: Landing,
});

const features = [
  { k: "01", t: "Community routes", d: "Captains submit shortcuts. AI verifies. You save minutes on every ride." },
  { k: "02", t: "Lowest fare", d: "No surge games. Transparent per-km pricing across bike, auto, and EV." },
  { k: "03", t: "Fast pickup", d: "Average captain 3 minutes away. Real-time ETAs, no guessing." },
  { k: "04", t: "Rewards that stack", d: "Cashback, referrals, streaks. Captains earn fuel credits too." },
  { k: "05", t: "Verified captains", d: "Aadhaar, license, RC, police check. Every ride, every time." },
  { k: "06", t: "Made for cities", d: "Bike lanes, back alleys, one-ways — mapped by people who ride them daily." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <RoleNav />

      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
        <div className="text-lg font-extrabold uppercase tracking-tighter">
          RideConnect<span className="text-primary">.</span>
        </div>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
          <a href="#community" className="text-sm text-muted-foreground hover:text-foreground">Community Routes</a>
          <a href="#captain" className="text-sm text-muted-foreground hover:text-foreground">For captains</a>
        </div>
        <Link to="/ride" className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground">
          Open app
        </Link>
      </nav>

      <header className="mx-auto max-w-6xl px-6 pt-16 pb-12">
        <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          RideConnect AI · v1.0 · Community-powered
        </p>
        <h1 className="max-w-4xl text-6xl font-extrabold leading-[0.9] tracking-tight md:text-8xl">
          Ride Smarter.
          <br />
          Reach Faster<span className="text-primary">.</span>
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground">
          Bike and auto rides guided by shortcuts real captains drive every day.
          Google Maps says 34 minutes. We usually get you there in 22.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/ride"
            className="inline-flex h-14 items-center justify-center rounded-full bg-secondary px-8 text-sm font-semibold text-secondary-foreground transition-transform active:scale-95"
          >
            Book a ride →
          </Link>
          <Link
            to="/captain"
            className="inline-flex h-14 items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-semibold transition-transform active:scale-95"
          >
            Become a captain
          </Link>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="relative col-span-2 aspect-[16/10] overflow-hidden rounded-3xl bg-muted ring-1 ring-black/5">
            <img src={mapHero} alt="Community-verified route map" className="h-full w-full object-cover" />
            <div className="absolute left-6 top-6 rounded-2xl bg-card/95 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Right now</p>
              <p className="text-sm font-bold">12,847 captains online</p>
            </div>
            <div className="absolute bottom-6 right-6 rounded-2xl bg-secondary p-4 text-secondary-foreground shadow-xl">
              <p className="font-mono text-[10px] uppercase tracking-wider opacity-70">Avg. time saved</p>
              <p className="text-3xl font-extrabold">12 min</p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-secondary p-6 text-secondary-foreground">
              <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Verified</p>
              <p className="mt-2 text-4xl font-extrabold">2,341</p>
              <p className="mt-1 text-xs opacity-70">community routes live</p>
            </div>
            <div className="rounded-3xl bg-primary p-6 text-secondary">
              <p className="font-mono text-[10px] uppercase tracking-wider opacity-70">This month</p>
              <p className="mt-2 text-4xl font-extrabold">1.2M</p>
              <p className="mt-1 text-xs opacity-70">rides completed</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Rating</p>
              <p className="mt-2 text-4xl font-extrabold">4.92</p>
              <p className="mt-1 text-xs text-muted-foreground">across 480k reviews</p>
            </div>
          </div>
        </div>
      </header>

      <section id="features" className="mx-auto max-w-6xl border-t border-border px-6 py-20">
        <div className="mb-12 flex items-end justify-between">
          <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">
            Why 1.2M riders picked RideConnect.
          </h2>
          <p className="hidden max-w-xs text-sm text-muted-foreground md:block">
            Built by people who actually take bike taxis. Every feature earns its place.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.k} className="bg-card p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{f.k}</p>
              <h3 className="mt-4 text-xl font-extrabold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="community" className="mx-auto max-w-6xl px-6 py-20">
        <div className="relative overflow-hidden rounded-[32px] bg-secondary p-10 text-secondary-foreground md:p-16">
          <div className="shimmer-line absolute inset-0 opacity-10" />
          <div className="relative grid gap-10 md:grid-cols-2">
            <div>
              <span className="rounded bg-accent/20 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                The differentiator
              </span>
              <h2 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                Community Route Intelligence.
              </h2>
              <p className="mt-4 max-w-md text-sm opacity-70">
                Google shows one route. Our captains know five. When a shortcut earns
                10 successful trips or 95% AI confidence, it becomes a verified community
                route — available to every rider.
              </p>
              <Link
                to="/routes"
                className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-secondary transition-transform active:scale-95"
              >
                Explore routes →
              </Link>
            </div>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider opacity-60">Google Route</p>
                  <p className="text-xs line-through opacity-50">15 km · 35 min</p>
                </div>
              </div>
              <div className="rounded-2xl bg-primary p-5 text-secondary">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider">Community Route</p>
                  <p className="text-sm font-bold">13 km · 23 min</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 border-t border-secondary/10 pt-3">
                  <Stat label="Saved" value="12m" />
                  <Stat label="Safety" value="98%" />
                  <Stat label="Trips" value="4.1k" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="captain" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">For captains</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              Your streets. Your shortcuts. Rewarded.
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Earn per trip, then earn again when the shortcut you discovered helps other captains.
              Top route discoverers get monthly cash bonuses.
            </p>
            <Link
              to="/captain"
              className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-secondary px-8 text-sm font-semibold text-secondary-foreground transition-transform active:scale-95"
            >
              Open captain portal →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: "₹2,400", s: "avg. daily earnings" },
              { l: "3 min", s: "avg. request wait" },
              { l: "₹500", s: "monthly fuel bonus" },
              { l: "24/7", s: "human support" },
            ].map((c) => (
              <div key={c.s} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-3xl font-extrabold">{c.l}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            © 2026 RideConnect AI · Made for cities
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
