import { useEffect, useState } from "react";
import { authApi, type AuthUser } from "@/lib/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleNav } from "@/components/rc/RoleNav";
import { useTheme, type Intensity, type Mode } from "@/lib/theme";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RIDEHER" },
      { name: "description", content: "Personalize the pink theme intensity and appearance." },
    ],
  }),
  component: SettingsPage,
});

const INTENSITIES: { id: Intensity; label: string; desc: string; swatch: string }[] = [
  { id: "soft", label: "Soft", desc: "Airier blush, calm and low-contrast.", swatch: "#F9A8D4" },
  { id: "balanced", label: "Balanced", desc: "Signature rose — the default.", swatch: "#EC4899" },
  { id: "vibrant", label: "Vibrant", desc: "Punchy, high-chroma magenta.", swatch: "#DB2777" },
];

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "light", label: "Light", desc: "Ivory background, deep rose accents." },
  { id: "dark", label: "Dark", desc: "Warm plum background, luminous pink." },
];

function SettingsPage() {
  const { intensity, mode, setIntensity, setMode, markers } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [statusError, setStatusError] = useState(false);
  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setStatusError(true));
  }, []);
  const customerStatus: "ACTIVE" | "SUSPENDED" | "UNKNOWN" = user ? "ACTIVE" : "UNKNOWN";

  return (
    <div className="min-h-screen flex flex-col bg-background pb-4">
      <div className="mx-auto max-w-2xl px-6 pt-10">
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tune the pink to match your mood.</p>

        <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Account status
              </p>
              <h2 className="mt-2 text-xl font-extrabold">Customer profile</h2>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                customerStatus === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {customerStatus === "ACTIVE"
                ? "Active"
                : customerStatus === "SUSPENDED"
                  ? "Suspended"
                  : statusError
                    ? "Unavailable"
                    : "Checking…"}
            </span>
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/70 p-4">
            <p className="text-sm font-semibold">Booking access</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {customerStatus === "ACTIVE"
                ? "Your account is active. Booking availability depends on your location and account role."
                : "Your account status could not be confirmed as active."}
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Theme intensity
          </h2>
          <div className="mt-3 grid gap-3">
            {INTENSITIES.map((opt) => {
              const active = intensity === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIntensity(opt.id)}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span
                    className="h-10 w-10 shrink-0 rounded-full ring-2 ring-background"
                    style={{ background: opt.swatch }}
                    aria-hidden
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                  </span>
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${active ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Appearance
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {MODES.map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="block text-sm font-semibold">{opt.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Preview
          </h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex -space-x-2">
              <span
                className="h-9 w-9 rounded-full border-2 border-background"
                style={{ background: markers.pickupFill, borderColor: markers.pickupStroke }}
              />
              <span
                className="h-9 w-9 rounded-full border-2 border-background"
                style={{ background: markers.dropFill, borderColor: markers.dropStroke }}
              />
              <span
                className="h-9 w-9 rounded-full border-2 border-background"
                style={{ background: markers.captainFill, borderColor: markers.captainStroke }}
              />
            </div>
            <div className="flex-1">
              <div
                className="h-1.5 w-full rounded-full"
                style={{ background: markers.routeStroke }}
              />
              <div
                className="mt-2 h-1.5 w-2/3 rounded-full"
                style={{ background: markers.routeTraveled }}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              Primary
            </button>
            <button className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground">
              Secondary
            </button>
            <button className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground">
              Accent
            </button>
          </div>
        </section>
      </div>
      <RoleNav />
    </div>
  );
}
