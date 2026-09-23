import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  History,
  Loader2,
  LocateFixed,
  MapPin,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import { RoleNav } from "@/components/rc/RoleNav";
import { Button } from "@/components/ui/button";
import { userApi, storage, type AuthUser, type SavedPlace, type SavedPlaceInput } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — RIDEHER" },
      { name: "description", content: "Manage your RIDEHER customer profile, saved addresses, ride history, and safety settings." },
      { property: "og:title", content: "My Profile — RIDEHER" },
      { property: "og:description", content: "Manage your RIDEHER customer profile and saved addresses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const emptyPlace: SavedPlaceInput = { label: "Home", address: "", latitude: 0, longitude: 0 };
const inputClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(storage.getUser());
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<any[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showPlaces, setShowPlaces] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [placeSaving, setPlaceSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", avatarUrl: "" });
  const [placeForm, setPlaceForm] = useState<SavedPlaceInput>(emptyPlace);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, historyRes, placesRes] = await Promise.all([
          userApi.getMe(),
          userApi.getRideHistory().catch(() => ({ data: [] })),
          userApi.getSavedPlaces().catch(() => ({ data: [] })),
        ]);
        setUser(profileRes.user);
        storage.saveUser(profileRes.user);
        setProfileForm({
          name: profileRes.user.name ?? "",
          email: profileRes.user.email ?? "",
          phone: profileRes.user.phone ?? "",
          avatarUrl: profileRes.user.avatarUrl ?? "",
        });
        setRides(historyRes.data ?? []);
        setPlaces(placesRes.data ?? []);
      } catch (loadError) {
        setError(errorMessage(loadError, "We couldn't load your profile."));
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  const startProfileEdit = () => {
    if (!user) return;
    setProfileForm({ name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "", avatarUrl: user.avatarUrl ?? "" });
    setEditingProfile(true);
    setError(null);
    setNotice(null);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileForm.name.trim() || (!profileForm.email.trim() && !profileForm.phone.trim())) {
      setError("Enter your name and at least one contact method.");
      return;
    }
    setProfileSaving(true);
    setError(null);
    try {
      const result = await userApi.updateMe({
        name: profileForm.name.trim(),
        email: profileForm.email.trim() || null,
        phone: profileForm.phone.trim() || null,
        avatarUrl: profileForm.avatarUrl.trim() || undefined,
      });
      setUser(result.user);
      storage.saveUser(result.user);
      setEditingProfile(false);
      setNotice("Profile details updated.");
    } catch (saveError) {
      setError(errorMessage(saveError, "We couldn't update your profile."));
    } finally {
      setProfileSaving(false);
    }
  };

  const resetPlaceForm = () => {
    setPlaceForm(emptyPlace);
    setEditingPlaceId(null);
  };

  const editPlace = (place: SavedPlace) => {
    setPlaceForm({ label: place.label, address: place.address, latitude: place.latitude, longitude: place.longitude });
    setEditingPlaceId(place.id);
    setError(null);
    setNotice(null);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available on this device.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPlaceForm((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude }));
        setLocating(false);
        setNotice("Current location added. Enter a name and address, then save it.");
      },
      () => {
        setError("We couldn't access your location. Allow location access or enter the coordinates.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const savePlace = async (event: FormEvent) => {
    event.preventDefault();
    if (!placeForm.label.trim() || !placeForm.address.trim() || !Number.isFinite(placeForm.latitude) || !Number.isFinite(placeForm.longitude) || (placeForm.latitude === 0 && placeForm.longitude === 0)) {
      setError("Enter a label, address, and valid location coordinates.");
      return;
    }
    setPlaceSaving(true);
    setError(null);
    try {
      const payload = { ...placeForm, label: placeForm.label.trim(), address: placeForm.address.trim() };
      const result = editingPlaceId
        ? await userApi.updateSavedPlace(editingPlaceId, payload)
        : await userApi.addSavedPlace(payload);
      setPlaces((current) => editingPlaceId
        ? current.map((place) => place.id === editingPlaceId ? result.data : place)
        : [...current, result.data]);
      resetPlaceForm();
      setNotice(editingPlaceId ? "Saved place updated." : "Saved place added.");
    } catch (saveError) {
      setError(errorMessage(saveError, "We couldn't save this place."));
    } finally {
      setPlaceSaving(false);
    }
  };

  const deletePlace = async (id: string) => {
    setError(null);
    try {
      await userApi.deleteSavedPlace(id);
      setPlaces((current) => current.filter((place) => place.id !== id));
      if (editingPlaceId === id) resetPlaceForm();
      setNotice("Saved place removed.");
    } catch (deleteError) {
      setError(errorMessage(deleteError, "We couldn't remove this place."));
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading profile" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <main className="mx-auto min-h-screen max-w-[430px] border-x border-border bg-background shadow-2xl">
        <div className="relative h-48 bg-primary">
          <div className="absolute -bottom-12 left-6">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-card shadow-lg">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" /> : <User className="h-12 w-12 text-muted-foreground" />}
            </div>
          </div>
        </div>

        <div className="mt-16 px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold">{user?.name || "My profile"}</h1>
              <p className="truncate text-sm text-muted-foreground">{user?.email || user?.phone}</p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={startProfileEdit}><Pencil /> Edit</Button>
          </div>

          {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-xs font-semibold text-success"><Check className="h-4 w-4" />{notice}</p>}
          {error && <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}

          {editingProfile && (
            <form onSubmit={saveProfile} className="mt-6 space-y-4 border-y border-border py-5">
              <div className="flex items-center justify-between"><h2 className="text-base font-bold">Edit profile</h2><Button type="button" size="icon" variant="ghost" aria-label="Close profile editor" onClick={() => setEditingProfile(false)}><X /></Button></div>
              <Field label="Full name"><input className={inputClass} value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} autoComplete="name" /></Field>
              <Field label="Email"><input className={inputClass} type="email" value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} autoComplete="email" /></Field>
              <Field label="Mobile number"><input className={inputClass} type="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} autoComplete="tel" /></Field>
              <Field label="Profile photo URL"><input className={inputClass} type="url" value={profileForm.avatarUrl} onChange={(event) => setProfileForm({ ...profileForm, avatarUrl: event.target.value })} placeholder="https://…" /></Field>
              <Button type="submit" className="w-full" disabled={profileSaving}>{profileSaving ? <Loader2 className="animate-spin" /> : <Check />} Save profile</Button>
            </form>
          )}

          <div className="mt-8 grid grid-cols-3 gap-4 rounded-md border border-border bg-card p-4 shadow-sm">
            <Stat value={user?.totalRides ?? 0} label="Rides" />
            <Stat value={user?.totalRating ?? 4.9} label="Rating" bordered />
            <Stat value={`${new Date().getFullYear() - 2024}y`} label="Member" />
          </div>

          <section className="mt-8 space-y-3">
            <h2 className="px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Manage</h2>
            <Button type="button" variant="outline" className="h-auto w-full justify-between p-4 text-left" onClick={() => setShowPlaces((value) => !value)} aria-expanded={showPlaces}>
              <span className="flex items-center gap-3"><span className="rounded-full bg-primary/10 p-2 text-primary"><MapPin /></span><span><span className="block text-sm font-bold">Saved places</span><span className="block text-[10px] font-normal text-muted-foreground">Home, work, and favourites</span></span></span>
              <ChevronRight className={showPlaces ? "rotate-90 transition" : "transition"} />
            </Button>

            {showPlaces && (
              <div className="space-y-4 border-l-2 border-primary/20 pl-4">
                {places.length === 0 ? <p className="py-2 text-xs text-muted-foreground">No saved places yet.</p> : places.map((place) => (
                  <article key={place.id} className="rounded-md border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-bold">{place.label}</h3><p className="mt-1 text-xs text-muted-foreground">{place.address}</p></div><div className="flex shrink-0"><Button type="button" size="icon" variant="ghost" aria-label={`Edit ${place.label}`} onClick={() => editPlace(place)}><Pencil /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Delete ${place.label}`} onClick={() => void deletePlace(place.id)}><Trash2 /></Button></div></div>
                    <a className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`} target="_blank" rel="noreferrer">Open directions <ExternalLink className="h-3.5 w-3.5" /></a>
                  </article>
                ))}

                <form onSubmit={savePlace} className="space-y-3 rounded-md bg-muted/60 p-4">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{editingPlaceId ? "Edit saved place" : "Add a place"}</h3>{editingPlaceId && <Button type="button" size="sm" variant="ghost" onClick={resetPlaceForm}>Cancel</Button>}</div>
                  <Field label="Label"><input className={inputClass} value={placeForm.label} onChange={(event) => setPlaceForm({ ...placeForm, label: event.target.value })} placeholder="Home" /></Field>
                  <Field label="Full address"><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={placeForm.address} onChange={(event) => setPlaceForm({ ...placeForm, address: event.target.value })} placeholder="Street, area, city, postcode" /></Field>
                  <Button type="button" variant="outline" className="w-full" onClick={useCurrentLocation} disabled={locating}>{locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} Use current location</Button>
                  <div className="grid grid-cols-2 gap-3"><Field label="Latitude"><input className={inputClass} type="number" step="any" value={placeForm.latitude || ""} onChange={(event) => setPlaceForm({ ...placeForm, latitude: Number(event.target.value) })} /></Field><Field label="Longitude"><input className={inputClass} type="number" step="any" value={placeForm.longitude || ""} onChange={(event) => setPlaceForm({ ...placeForm, longitude: Number(event.target.value) })} /></Field></div>
                  <Button type="submit" className="w-full" disabled={placeSaving}>{placeSaving ? <Loader2 className="animate-spin" /> : <Plus />} {editingPlaceId ? "Update place" : "Save place"}</Button>
                </form>
              </div>
            )}

            <Button type="button" variant="outline" className="h-auto w-full justify-between p-4 text-left">
              <span className="flex items-center gap-3"><span className="rounded-full bg-primary/10 p-2 text-primary"><Shield /></span><span><span className="block text-sm font-bold">Safety center</span><span className="block text-[10px] font-normal text-muted-foreground">Emergency contacts and tools</span></span></span><ChevronRight />
            </Button>
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between px-1"><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Recent trips</h2><Link to="/ride" className="text-[10px] font-bold uppercase text-primary">View all</Link></div>
            {rides.length > 0 ? <div className="space-y-3">{rides.slice(0, 3).map((ride, index) => (
              <article key={ride.id ?? index} className="rounded-md border border-border bg-card p-4"><div className="mb-2 flex items-start justify-between"><span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(ride.created_at).toLocaleDateString()}</span><span className="text-xs font-black">₹{ride.fare_inr}</span></div><p className="truncate text-[11px] font-medium">{ride.pickup_label}</p><p className="mt-2 truncate text-[11px] font-medium text-muted-foreground">{ride.drop_label}</p></article>
            ))}</div> : <div className="rounded-md border border-dashed border-border p-8 text-center"><History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">No trips yet. Start riding!</p></div>}
          </section>
        </div>
      </main>
      <RoleNav />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

function Stat({ value, label, bordered = false }: { value: string | number; label: string; bordered?: boolean }) {
  return <div className={bordered ? "border-x border-border text-center" : "text-center"}><p className="text-lg font-black text-primary">{value}</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p></div>;
}