import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Calendar,
  Check,
  ChevronRight,
  History,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { RoleNav } from "@/components/rc/RoleNav";
import { Button } from "@/components/ui/button";
import { userApi, storage, type AuthUser } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — RIDEHER" },
      {
        name: "description",
        content: "Manage your RIDEHER profile, ride history, and safety settings.",
      },
      { property: "og:title", content: "My Profile — RIDEHER" },
      { property: "og:description", content: "Manage your RIDEHER profile and ride history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const inputClass =
  "h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [rides, setRides] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", avatarUrl: "" });

  useEffect(() => {
    setUser(storage.getUser());
    if (!storage.getAccessToken()) {
      setSignedOut(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          userApi.getMe(),
          userApi.getRideHistory().catch(() => ({ data: [] })),
        ]);
        setUser(profileRes.user);
        storage.saveUser(profileRes.user);
        setRides(historyRes.data ?? []);
      } catch (e) {
        if ((e as { status?: number })?.status === 401 || !storage.getAccessToken())
          setSignedOut(true);
        else setError(errorMessage(e, "We couldn't load your profile."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startEdit = () => {
    if (!user) return;
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      avatarUrl: user.avatarUrl ?? "",
    });
    setEditing(true);
    setError(null);
    setNotice(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setError("Enter your name and at least one contact method.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await userApi.updateMe({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        avatarUrl: form.avatarUrl.trim() || undefined,
      });
      setUser(result.user);
      storage.saveUser(result.user);
      setEditing(false);
      setNotice("Profile updated.");
    } catch (e) {
      setError(errorMessage(e, "We couldn't update your profile."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading profile" />
      </div>
    );
  }

  if (signedOut) {
    return (
      <div className="min-h-screen bg-background pb-4">
        <main className="mx-auto flex max-w-[430px] flex-col items-center px-6 pt-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-9 w-9" />
          </div>
          <h1 className="mt-5 text-xl font-extrabold">Sign in to view your profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your session has ended or you haven't signed in yet.
          </p>
          <Button asChild className="mt-6 w-full rounded-2xl">
            <Link to="/auth" search={{ mode: "signin" } as never}>
              Sign in
            </Link>
          </Button>
        </main>
        <RoleNav />
      </div>
    );
  }

  const initials = (user?.name || "R")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-4">
      <main className="mx-auto max-w-[430px] px-5 pt-6">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          My profile
        </h1>

        <section className="mt-4 rounded-3xl bg-gradient-to-br from-primary/15 via-accent/10 to-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-extrabold text-primary-foreground ring-4 ring-background">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : user ? (
                initials
              ) : (
                <User className="h-9 w-9" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-extrabold">{user?.name || "Welcome"}</p>
              {user?.email && (
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </p>
              )}
              {user?.phone && (
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {user.phone}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="mt-5 w-full rounded-2xl"
            onClick={startEdit}
            disabled={!user}
          >
            <Pencil /> Edit profile
          </Button>
        </section>

        {notice && (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-xs font-semibold text-success"
          >
            <Check className="h-4 w-4" />
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive"
          >
            {error}
          </p>
        )}

        {editing && (
          <form
            onSubmit={save}
            className="mt-4 space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Edit profile</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close editor"
                onClick={() => setEditing(false)}
              >
                <X />
              </Button>
            </div>
            <Field label="Full name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
              />
            </Field>
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
            </Field>
            <Field label="Mobile number">
              <input
                className={inputClass}
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                autoComplete="tel"
              />
            </Field>
            <Field label="Profile photo URL">
              <input
                className={inputClass}
                type="url"
                value={form.avatarUrl}
                onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Button type="submit" className="w-full rounded-2xl" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />} Save changes
            </Button>
          </form>
        )}

        <section className="mt-4 grid grid-cols-3 gap-3">
          <Stat value={user?.totalRides ?? rides.length} label="Rides" />
          <Stat value={user?.totalRating ?? "—"} label="Rating" />
          <Stat
            value={
              user?.memberSince
                ? new Date(user.memberSince).getFullYear()
                : new Date().getFullYear()
            }
            label="Since"
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card">
          <MenuRow
            to="/profile"
            icon={<Shield />}
            title="Safety center"
            subtitle="In-app emergency contacts are not yet available"
          />
          <MenuRow
            to="/settings"
            icon={<Settings />}
            title="Settings & appearance"
            subtitle="Theme and preferences"
          />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold">Recent trips</h2>
            <Link to="/history" className="text-xs font-semibold text-primary">
              View all
            </Link>
          </div>
          {rides.length > 0 ? (
            <div className="space-y-3">
              {rides.slice(0, 3).map((ride, i) => (
                <article
                  key={ride.id ?? i}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(ride.createdAt ?? ride.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-bold">
                      ₹{ride.fareFinal ?? ride.fareEstimate ?? ride.fare_inr ?? "—"}
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium">
                    {ride.pickupAddress ?? ride.pickup_label}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {ride.dropAddress ?? ride.drop_label}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center">
              <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No trips yet. Your rides will show here.
              </p>
            </div>
          )}
        </section>
      </main>
      <RoleNav />
    </div>
  );
}

function MenuRow({
  to,
  icon,
  title,
  subtitle,
}: {
  to: "/profile" | "/settings";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 hover:bg-muted/50"
    >
      <span className="rounded-2xl bg-primary/10 p-2.5 text-primary [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card py-4 text-center">
      <p className="text-lg font-black text-primary">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
