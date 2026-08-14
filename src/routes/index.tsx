import { createFileRoute, Link } from "@tanstack/react-router";
import mapHero from "@/assets/map-hero.jpg";
import { RoleNav } from "@/components/rc/RoleNav";
import { storage } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RIDEHER — Safe Rides. Her Way." },
      {
        name: "description",
        content:
          "India's trusted women-only ride platform. Verified women captains, live safety monitoring, AI smart routes, and a community built exclusively for women.",
      },
      { property: "og:title", content: "RIDEHER — Safe Rides. Her Way." },
      {
        property: "og:description",
        content:
          "Book rides with verified women captains. Live tracking, SOS, and AI community routes — built by women, for women.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#safety", label: "Safety" },
  { href: "#how", label: "How It Works" },
  { href: "#captain", label: "Become a Captain" },
  { href: "#community", label: "Community Routes" },
  { href: "#rewards", label: "Rewards" },
  { href: "#contact", label: "Contact" },
];

const heroBadges = [
  "Women-Only Platform",
  "Verified Women Captains",
  "Live Ride Tracking",
  "Emergency SOS",
  "AI Smart Routes",
  "Secure Payments",
];

const heroStats = [
  { v: "50,000+", l: "Happy Riders" },
  { v: "8,000+", l: "Verified Women Captains" },
  { v: "1M+", l: "Safe Rides" },
  { v: "99.8%", l: "Safety Rating" },
];

const whyCards = [
  {
    t: "Women-Only Community",
    d: "Only verified women passengers and women captains. A sisterhood on wheels.",
  },
  {
    t: "Verified Captains",
    d: "Identity, police, license, vehicle, and background verification — every captain, every time.",
  },
  {
    t: "AI Smart Routes",
    d: "Our AI recommends safer, faster routes verified by the women who drive them daily.",
  },
  {
    t: "Live Safety Monitoring",
    d: "Every ride tracked pickup to drop. Route deviations flagged instantly.",
  },
  {
    t: "SOS Emergency Assistance",
    d: "One-tap emergency alerts with live location sharing to trusted contacts and support.",
  },
  {
    t: "Secure Digital Payments",
    d: "UPI, cards, wallets, or cash — pay the way you prefer, always protected.",
  },
];

const safetyPromises = [
  "Verified Women Captains",
  "Live GPS Tracking",
  "Emergency SOS",
  "Family Ride Sharing",
  "Trusted Emergency Contacts",
  "AI Route Monitoring",
  "Secure In-App Calling",
  "Number Privacy",
  "Ride Recording Option",
  "Night Ride Monitoring",
  "Route Deviation Alerts",
  "24×7 Support",
];

const steps = [
  { k: "01", t: "Register", d: "Sign up in under a minute with your phone number." },
  { k: "02", t: "Verify Account", d: "Quick identity check keeps our community trusted." },
  { k: "03", t: "Choose Pickup & Destination", d: "Set where you are and where you're going." },
  { k: "04", t: "Matched with a Verified Woman Captain", d: "Nearest verified woman captain accepts your ride." },
  { k: "05", t: "Track Ride Live", d: "Real-time GPS, ETA, and route visible to your trusted contacts." },
  { k: "06", t: "Reach Safely", d: "Rate your captain and travel again with confidence." },
];

const captainBenefits = [
  "Flexible Working Hours",
  "Daily Earnings",
  "Weekly Payouts",
  "Fuel Rewards",
  "AI Route Rewards",
  "Referral Bonuses",
  "Performance Incentives",
  "Insurance Support",
];

const routeBenefits = [
  { t: "Faster Routes", d: "Save an average of 12 minutes per trip." },
  { t: "Less Traffic", d: "Skip the choke points locals learned to avoid." },
  { t: "Better Road Conditions", d: "Smoother roads, fewer potholes, safer surfaces." },
  { t: "Higher Safety Score", d: "Well-lit streets with active foot traffic prioritized." },
  { t: "Fuel Savings", d: "Shorter distances mean lower fares and greener rides." },
  { t: "Community Verified", d: "Every route validated by real women captains and AI." },
];

const testimonials = [
  {
    q: "As a nurse working night shifts, RIDEHER changed my life. Knowing my captain is a verified woman lets me breathe easy.",
    n: "Aisha K.",
    r: "ICU Nurse, Bengaluru",
  },
  {
    q: "I take three rides a day between campus and my internship. The SOS button and family tracking give my parents peace of mind.",
    n: "Priya S.",
    r: "Student, Pune",
  },
  {
    q: "I built my consulting practice thanks to being able to travel confidently to late client meetings. RIDEHER is infrastructure for women.",
    n: "Meera R.",
    r: "Founder, Mumbai",
  },
  {
    q: "As a homemaker, I finally travel to the market and temple without depending on anyone. Independence, delivered.",
    n: "Lakshmi V.",
    r: "Homemaker, Chennai",
  },
];

const impactStats = [
  { v: "50,000+", l: "Women Served" },
  { v: "8,000+", l: "Verified Captains" },
  { v: "1M+", l: "Safe Trips Completed" },
  { v: "2,341", l: "Community Routes Shared" },
  { v: "24", l: "Cities Covered" },
  { v: "12,000+", l: "Emergency Responses" },
];

function Landing() {
  return (
    <div id="home" className="min-h-screen bg-background text-foreground">
      <RoleNav />

      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-xl font-black tracking-tight">
            RIDE<span className="text-primary">HER</span>
          </div>
          <div className="hidden items-center gap-6 lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!storage.getUser() ? (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="hidden rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
                >
                  Login
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="hidden rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-muted sm:inline-flex"
                >
                  Register
                </Link>
              </>
            ) : (
              <span className="hidden text-[10px] font-bold uppercase tracking-tight text-muted-foreground sm:inline-flex mr-2">
                Hi, {storage.getUser()?.name}
              </span>
            )}
            <Link
              to="/ride"
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95"
            >
              Book Ride
            </Link>
            <Link
              to="/captain"
              className="hidden rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground md:inline-flex"
            >
              Become a Captain
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
          <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-16 pb-24 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-primary backdrop-blur">
              ● Safe Rides. Her Way.
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              India's Trusted
              <br />
              Women- Preferred&nbsp;
              <br />
              Ride Platform<span className="text-primary">.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Travel with confidence using RIDEHER — every ride powered by verified women
              captains, live safety monitoring, AI-powered smart routes, and a trusted
              community built exclusively for women.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/ride"
                className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
              >
                Book Your Ride →
              </Link>
              <Link
                to="/captain"
                className="inline-flex h-14 items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-bold transition-transform active:scale-95"
              >
                Become a Captain
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-2">
              {heroBadges.map((b) => (
                <div
                  key={b}
                  className="animate-fade-up rounded-full border border-primary/30 bg-card/70 px-3 py-1.5 text-[11px] font-semibold backdrop-blur"
                >
                  ✓ {b}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] ring-1 ring-primary/20 shadow-2xl shadow-primary/20">
              <img
                src={mapHero}
                alt="Women captain and passenger in a safe urban ride"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-transparent to-transparent" />

              <div className="absolute left-5 top-5 animate-fade-up rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur">
                <p className="font-mono text-[9px] uppercase tracking-wider text-primary">Live</p>
                <p className="text-xs font-bold">Captain Sana · 2 min away</p>
              </div>
              <div className="absolute right-5 top-24 animate-fade-up rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg">
                <p className="font-mono text-[9px] uppercase tracking-wider opacity-80">Safety</p>
                <p className="text-sm font-black">SOS Ready</p>
              </div>
              <div className="absolute bottom-5 left-5 right-5 animate-fade-up rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Verified Woman Captain
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm font-bold">★ 4.96 · 1,240 rides</p>
                  <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success-foreground">
                    ID Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl border-t border-border/60 px-6 py-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {heroStats.map((s) => (
              <div key={s.l}>
                <p className="text-3xl font-black text-primary md:text-4xl">{s.v}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ABOUT */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">About RIDEHER</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Built to Empower Women Through Safe Mobility.
            </h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              RIDEHER is India's women-first ride booking platform, designed to create a secure
              transportation ecosystem where women passengers travel exclusively with verified
              women captains.
            </p>
            <p>
              Whether you're commuting to work, college, shopping, the airport, or travelling
              late at night, RIDEHER ensures every journey is safe, reliable, and comfortable.
            </p>
            <p className="font-semibold text-foreground">
              Built by Women. For Women. Every Journey Begins with Trust.
            </p>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="border-t border-border bg-muted/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex items-end justify-between">
            <h2 className="max-w-2xl text-4xl font-black tracking-tight md:text-5xl">
              Why Choose RIDEHER.
            </h2>
            <p className="hidden max-w-xs text-sm text-muted-foreground md:block">
              Six pillars that make RIDEHER the safest way for women to move through their city.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-2 lg:grid-cols-3">
            {whyCards.map((c, i) => (
              <div key={c.t} className="group bg-card p-8 transition hover:bg-primary/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-5 text-xl font-black">{c.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAFETY */}
      <section id="safety" className="relative overflow-hidden py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-secondary via-secondary to-secondary/90" />
        <div className="mx-auto max-w-7xl px-6 text-secondary-foreground">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              Women's Safety Promise
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
              Your Safety is Our Highest Priority.
            </h2>
            <p className="mt-4 max-w-xl text-sm opacity-80">
              Twelve safety systems working together on every ride, from the moment you book
              until the moment you're home.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {safetyPromises.map((p) => (
              <div
                key={p}
                className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-5 backdrop-blur"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  ✓
                </span>
                <p className="text-sm font-semibold">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">How It Works</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
            Six steps from tap to safe arrival.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <div key={s.k} className="relative rounded-3xl border border-border bg-card p-6">
              <div className="absolute -top-4 left-6 rounded-full bg-primary px-3 py-1 font-mono text-[10px] font-bold text-primary-foreground">
                STEP {s.k}
              </div>
              <h3 className="mt-4 text-xl font-black">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CAPTAIN */}
      <section id="captain" className="border-t border-border bg-muted/40 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              Become a Woman Captain
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Earn Independently. Empower Other Women.
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Become a verified RIDEHER Captain and earn flexible income while helping thousands
              of women travel safely every day. Your streets. Your schedule. Your income.
            </p>
            <Link
              to="/captain"
              className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
            >
              Register as Captain →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {captainBenefits.map((b) => (
              <div
                key={b}
                className="rounded-2xl border border-border bg-card p-4 text-sm font-semibold"
              >
                <span className="mr-2 text-primary">◆</span>
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY ROUTES */}
      <section id="community" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            AI Community Routes
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
            Smarter Routes Built by Women.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Verified women captains contribute safer, faster travel routes. Our AI validates every
            community route before recommending it to future passengers.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-2 lg:grid-cols-3">
          {routeBenefits.map((r) => (
            <div key={r.t} className="bg-card p-8">
              <h3 className="text-lg font-black">{r.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{r.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            to="/routes"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-semibold"
          >
            Explore community routes →
          </Link>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border bg-muted/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              Testimonials
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Women who move with RIDEHER.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.n} className="rounded-3xl border border-border bg-card p-8">
                <blockquote className="text-lg font-medium leading-relaxed">"{t.q}"</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                    {t.n[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.n}</p>
                    <p className="text-xs text-muted-foreground">{t.r}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACT */}
      <section id="rewards" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Our Impact</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
            Measured in safe journeys.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {impactStats.map((s) => (
            <div
              key={s.l}
              className="rounded-3xl bg-gradient-to-br from-primary/15 to-accent/20 p-8"
            >
              <p className="text-5xl font-black text-primary">{s.v}</p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MOBILE APP */}
      <section className="border-t border-border bg-secondary py-24 text-secondary-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              Mobile App
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Travel Freely. Travel Fearlessly.
            </h2>
            <p className="mt-4 max-w-md text-sm opacity-80">
              Download RIDEHER on Android or iPhone. Your safe travel companion, always in your
              pocket.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#"
                className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg"
              >
                ▶ Download on Google Play
              </a>
              <a
                href="#"
                className="rounded-2xl border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-bold backdrop-blur"
              >
                🍎 Download on App Store
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <div className="grid h-24 w-24 grid-cols-6 grid-rows-6 gap-[2px] rounded-xl bg-background p-2">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-[1px] ${
                      (i * 7) % 3 === 0 ? "bg-foreground" : "bg-transparent"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs opacity-70">
                Scan to download
                <br />
                the RIDEHER app
              </p>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <PhoneMock />
            <PhoneMock variant="ios" />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="border-t border-border bg-background px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <div className="text-xl font-black">
                RIDE<span className="text-primary">HER</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Safe Rides. Her Way. Built by Women. For Women.
              </p>
            </div>
            <FooterCol
              title="Company"
              items={["About RIDEHER", "Careers", "Community Guidelines", "Contact"]}
            />
            <FooterCol
              title="Safety & Support"
              items={["Safety Center", "Emergency Support", "FAQs", "24×7 Support"]}
            />
            <FooterCol
              title="Legal"
              items={["Privacy Policy", "Terms & Conditions", "Become a Captain", "Social Media"]}
            />
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              © 2026 RIDEHER · Your Safe Travel Companion
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <a href="#">Instagram</a>
              <a href="#">LinkedIn</a>
              <a href="#">YouTube</a>
              <a href="#">X</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i}>
            <a href="#" className="hover:text-primary">
              {i}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhoneMock({ variant = "android" }: { variant?: "android" | "ios" }) {
  return (
    <div className="relative h-[380px] w-[180px] rounded-[36px] border-[6px] border-foreground/90 bg-card shadow-2xl">
      <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-foreground/90" />
      <div className="mt-8 flex h-full flex-col items-center gap-2 px-3 pt-4">
        <div className="text-[10px] font-black text-primary">
          RIDE<span className="text-foreground">HER</span>
        </div>
        <div className="h-24 w-full rounded-xl bg-gradient-to-br from-primary/30 to-accent/40" />
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="mt-2 h-8 w-full rounded-full bg-primary text-center text-[9px] font-bold leading-8 text-primary-foreground">
          Book Ride
        </div>
        <p className="mt-1 text-[8px] uppercase tracking-widest text-muted-foreground">
          {variant === "ios" ? "iOS" : "Android"}
        </p>
      </div>
    </div>
  );
}
