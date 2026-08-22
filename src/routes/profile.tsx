import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleNav } from "@/components/rc/RoleNav";
import { userApi, storage, type AuthUser } from "@/lib/api";
import { Loader2, User, MapPin, History, ChevronRight, Shield, Star, Calendar } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — RIDEHER" },
      { name: "description", content: "Manage your RIDEHER profile, ride history and safety settings." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(storage.getUser());
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, historyRes] = await Promise.all([
          userApi.getMe(),
          userApi.getRideHistory().catch(() => ({ data: [] }))
        ]);
        setUser(profileRes.user);
        setRides(historyRes.data || []);
      } catch (error) {
        console.error("Failed to load profile data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-[430px] border-x border-border bg-background min-h-screen shadow-2xl">
        {/* Header */}
        <div className="relative h-48 bg-gradient-to-br from-rose-400 to-rose-600">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -bottom-12 left-6">
            <div className="h-24 w-24 rounded-full border-4 border-background bg-card flex items-center justify-center overflow-hidden shadow-lg">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-16 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{user?.name}</h1>
              <p className="text-sm text-muted-foreground">{user?.email || user?.phone}</p>
            </div>
            <Link 
              to="/settings"
              className="rounded-full bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-secondary-foreground"
            >
              Edit
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="text-center">
              <p className="text-lg font-black text-primary">{user?.totalRides || 0}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Rides</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-lg font-black text-primary">{user?.totalRating || 4.9}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Rating</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-primary">{new Date().getFullYear() - 2024}y</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Member</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-1">Manage</h2>
            
            <button className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                  <MapPin size={18} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">Saved Places</p>
                  <p className="text-[10px] text-muted-foreground">Home, Work, and Favorites</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            <button className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                  <Shield size={18} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">Safety Center</p>
                  <p className="text-[10px] text-muted-foreground">Emergency contacts & tools</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Recent Trips */}
          <div className="mt-8">
            <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Recent Trips</h2>
              <Link to="/ride" className="text-[10px] font-bold text-primary uppercase">View All</Link>
            </div>

            {rides.length > 0 ? (
              <div className="space-y-3">
                {rides.slice(0, 3).map((ride, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-muted-foreground" />
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(ride.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-xs font-black">₹{ride.fare_inr}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <p className="text-[11px] font-medium truncate">{ride.pickup_label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-rose-500" />
                        <p className="text-[11px] font-medium truncate">{ride.drop_label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <History className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No trips yet. Start riding!</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <RoleNav />
    </div>
  );
}
