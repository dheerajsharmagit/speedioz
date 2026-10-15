import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { MapPin, Navigation, Phone, Timer } from "lucide-react";
import { RoleNav } from "@/components/rc/RoleNav";
import { API_BASE_URL, captainApi, rideApi, storage, type BookingDetails } from "@/lib/api";

export const Route = createFileRoute("/captain")({
  head: () => ({
    meta: [
      { title: "Captain Portal — RIDEHER" },
      { name: "description", content: "Go online, receive live ride offers and navigate to pickups as a RIDEHER captain." },
      { property: "og:title", content: "Captain Portal — RIDEHER" },
      { property: "og:description", content: "Go online, receive live ride offers and navigate to pickups as a RIDEHER captain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaptainPage,
});

type VehicleType = "BIKE" | "AUTO" | "CAB";

type Offer = {
  rideId: string;
  pickup: { address: string; lat?: number; lng?: number };
  drop: { address: string; lat?: number; lng?: number };
  vehicleType: string;
  fareEstimate: number;
  captainEarningsEstimate?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  expiresAt: number; // ms epoch
};

// Accept both the socket `ride:request` shape and REST list shapes.
function toOffer(raw: any): Offer | null {
  const id = raw?.rideId ?? raw?.id;
  if (!id) return null;
  const pickup = raw.pickup ?? { address: raw.pickupAddress, lat: raw.pickupLat, lng: raw.pickupLng };
  const drop = raw.drop ?? { address: raw.dropAddress, lat: raw.dropLat, lng: raw.dropLng };
  const secs = Number(raw.expiresInSeconds ?? 30);
  const expiresAt = raw.expiresAt ? Date.parse(raw.expiresAt) : Date.now() + secs * 1000;
  return {
    rideId: String(id),
    pickup: { ...pickup, address: pickup?.address ?? "Pickup" },
    drop: { ...drop, address: drop?.address ?? "Drop" },
    vehicleType: String(raw.vehicleType ?? "BIKE"),
    fareEstimate: Number(raw.fareEstimate ?? 0),
    captainEarningsEstimate: raw.captainEarningsEstimate != null ? Number(raw.captainEarningsEstimate) : undefined,
    paymentMethod: raw.paymentMethod,
    paymentStatus: raw.paymentStatus,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 30000,
  };
}

function paymentBadge(o: Offer): string {
  const m = String(o.paymentMethod ?? "CASH").toUpperCase();
  if (m === "CASH") return "Cash";
  if (m === "WALLET") return "Wallet";
  const label = m === "UPI" ? "UPI" : "Card";
  return String(o.paymentStatus ?? "").toUpperCase() === "PAID" ? `${label}-Paid` : `${label}-Pending`;
}

function CaptainPage() {
  const [online, setOnline] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("BIKE");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [active, setActive] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const signedIn = typeof window !== "undefined" && !!storage.getAccessToken();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Drop expired offers.
  useEffect(() => {
    setOffers((list) => list.filter((o) => o.expiresAt > now));
  }, [now]);

  function addOffers(raws: any[]) {
    setOffers((list) => {
      const map = new Map(list.map((o) => [o.rideId, o]));
      for (const r of raws) {
        const o = toOffer(r);
        if (o && o.expiresAt > Date.now()) map.set(o.rideId, { ...map.get(o.rideId), ...o });
      }
      return [...map.values()];
    });
  }

  // Socket (/captain namespace) + GPS while online.
  useEffect(() => {
    if (!online) return;
    const token = storage.getAccessToken();
    const socket = io(`${API_BASE_URL.replace("/api/v1", "")}/captain`, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("status:toggle", { isOnline: true, vehicleType }));
    socket.on("ride:request", (data: any) => addOffers([data]));
    socket.on("ride:accepted", (data: any) => {
      // Someone else took it (or our accept confirmed) — remove from list.
      setOffers((l) => l.filter((o) => o.rideId !== (data?.rideId ?? data?.id)));
    });
    socket.on("ride:cancelled_by_rider", (data: any) => {
      const id = data?.rideId ?? data?.id;
      setOffers((l) => l.filter((o) => o.rideId !== id));
      setActive((a) => {
        if (a && a.rideId === id) {
          setNotice("The rider cancelled this trip.");
          return null;
        }
        return a;
      });
    });
    socket.on("ride:otp_verified", () => setNotice("OTP verified — trip started. Drive safe!"));

    let watchId: number | null = null;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          const next = { lat: p.coords.latitude, lng: p.coords.longitude };
          posRef.current = next;
          setPos(next);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000 },
      );
    }
    // Send location every second.
    const tick = window.setInterval(() => {
      if (posRef.current) socket.emit("location:update", posRef.current);
    }, 1000);

    return () => {
      socket.emit("status:toggle", { isOnline: false, vehicleType });
      socket.disconnect();
      socketRef.current = null;
      window.clearInterval(tick);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [online, vehicleType]);

  // Polling fallback every 10s.
  useEffect(() => {
    if (!online) { setOffers([]); return; }
    let cancelled = false;
    const poll = async () => {
      try {
        const list = await captainApi.offers();
        if (!cancelled) addOffers(list);
      } catch (e) {
        console.warn("Offer polling failed", e);
      }
    };
    void poll();
    const id = window.setInterval(poll, 10000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [online]);

  async function toggleOnline() {
    setError(null);
    const next = !online;
    setOnline(next);
    captainApi.setAvailability(next).catch(() => {});
  }

  async function accept(o: Offer) {
    setError(null);
    setBusyId(o.rideId);
    try {
      await captainApi.acceptOffer(o.rideId);
      setOffers((l) => l.filter((x) => x.rideId !== o.rideId));
      const details = await rideApi.bookingDetails(o.rideId);
      // Captains never see the rider's OTP.
      const { otp: _otp, ...safe } = details.data;
      setActive(safe as BookingDetails);
    } catch (e: any) {
      setError(e?.error?.message || "Couldn't accept this ride — it may have been taken.");
      setOffers((l) => l.filter((x) => x.rideId !== o.rideId));
    } finally {
      setBusyId(null);
    }
  }

  async function arrived() {
    if (!active) return;
    setBusyId(active.rideId);
    try {
      await captainApi.arrived(active.rideId);
      setActive({ ...active, status: "ARRIVING" });
      setNotice("Marked as arrived. Ask the rider for her OTP.");
    } catch (e: any) {
      setError(e?.error?.message || "Couldn't mark arrival. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <div className="mx-auto max-w-3xl px-5 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Captain portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Ride offers</h1>

        {!signedIn && (
          <p className="mt-4 rounded-2xl border border-border bg-muted p-4 text-sm">Sign in with your captain account to receive offers.</p>
        )}

        {/* Online toggle */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-extrabold">{online ? "You're online" : "You're offline"}</p>
              <p className="text-xs text-muted-foreground">
                {online ? (pos ? `Sharing location · ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : "Waiting for GPS…") : "Go online to start receiving ride offers."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={online}
              aria-label="Online"
              onClick={toggleOnline}
              className={`relative h-14 w-28 shrink-0 rounded-full transition ${online ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-1.5 h-11 w-11 rounded-full bg-background shadow transition-all ${online ? "left-[3.75rem]" : "left-1.5"}`} />
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            {(["BIKE", "AUTO", "CAB"] as VehicleType[]).map((v) => (
              <button
                key={v}
                onClick={() => setVehicleType(v)}
                className={`rounded-full px-4 py-2 text-xs font-bold ${vehicleType === v ? "bg-secondary text-secondary-foreground" : "border border-border"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </section>

        {error && <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
        {notice && <p className="mt-4 rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">{notice}</p>}

        {/* Active trip / navigate to pickup */}
        {active && (
          <section className="mt-6 rounded-3xl bg-secondary p-6 text-secondary-foreground">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {active.status === "ARRIVING" ? "At pickup — ask for OTP" : "Navigate to pickup"}
            </p>
            <h2 className="mt-2 text-xl font-extrabold">{active.pickup.address}</h2>
            {active.customer?.name && <p className="mt-1 text-sm font-semibold">Rider: {active.customer.name}{active.customer.phone ? ` · ${active.customer.phone}` : ""}</p>}
            <p className="mt-1 text-xs opacity-70">Drop: {active.drop.address} · ₹{active.fareEstimate}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${active.pickup.lat},${active.pickup.lng}`}
                target="_blank" rel="noreferrer"
                className="flex h-12 items-center justify-center gap-1 rounded-full bg-primary text-xs font-bold text-primary-foreground"
              ><Navigation className="h-4 w-4" /> Navigate</a>
              <a
                href={active.customer?.phone ? `tel:${active.customer.phone}` : undefined}
                aria-disabled={!active.customer?.phone}
                className={`flex h-12 items-center justify-center gap-1 rounded-full border border-secondary-foreground/30 text-xs font-bold ${active.customer?.phone ? "" : "pointer-events-none opacity-60"}`}
              ><Phone className="h-4 w-4" /> Call rider</a>
              <button
                onClick={arrived}
                disabled={busyId === active.rideId || active.status === "ARRIVING"}
                className="h-12 rounded-full bg-background text-xs font-bold text-foreground disabled:opacity-50"
              >{active.status === "ARRIVING" ? "Arrived ✓" : "Arrived"}</button>
            </div>
          </section>
        )}

        {/* Offers */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Incoming offers</h2>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{online ? `${offers.length} live` : "Offline"}</span>
          </div>
          {online && offers.length === 0 && (
            <div className="rounded-3xl bg-muted p-6 text-center text-sm text-muted-foreground">Waiting for the next ride request…</div>
          )}
          <div className="space-y-3">
            {offers.map((o) => {
              const left = Math.max(0, Math.ceil((o.expiresAt - now) / 1000));
              return (
                <div key={o.rideId} className="rounded-3xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold"><MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />{o.pickup.address}</p>
                      <p className="flex items-center gap-2 truncate text-sm font-semibold"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{o.drop.address}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-bold uppercase">
                        <span className="rounded-full bg-muted px-2 py-0.5">{o.vehicleType}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5">{paymentBadge(o)}</span>
                        <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary"><Timer className="h-3 w-3" />{left}s</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-extrabold">₹{o.fareEstimate}</p>
                      {o.captainEarningsEstimate != null && <p className="text-[11px] text-muted-foreground">You earn: ₹{o.captainEarningsEstimate}</p>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
                    <button
                      onClick={() => { captainApi.decline(o.rideId).catch(() => {}); setOffers((l) => l.filter((x) => x.rideId !== o.rideId)); }}
                      className="h-11 rounded-full border border-border px-4 text-xs font-bold"
                    >Pass</button>
                    <button
                      onClick={() => accept(o)}
                      disabled={!!active || busyId === o.rideId}
                      className="h-11 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
                    >{busyId === o.rideId ? "Accepting…" : "Accept"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <RoleNav />
    </div>
  );
}
