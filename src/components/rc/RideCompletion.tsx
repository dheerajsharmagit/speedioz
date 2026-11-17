import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { Ride } from "@/lib/rides";
import { CustomerCollection } from "./CustomerCollection";

export function RideCompletion({ ride, onRate }: { ride: Ride; onRate: () => void }) {
  return (
    <section aria-labelledby="ride-completion-title" className="min-w-0 space-y-5 px-4 pb-5">
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Check aria-hidden="true" className="size-6" />
        </span>
        <h1 id="ride-completion-title" className="mt-4 text-2xl font-extrabold tracking-tight">
          You’ve arrived
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Thanks for riding with RideHer.</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-y border-border py-4">
          <span className="text-sm font-semibold text-muted-foreground">Total fare</span>
          <span className="break-words text-3xl font-extrabold">
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 2,
            }).format(ride.fare_inr)}
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex min-w-0 gap-3">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pickup</p>
              <p className="break-words leading-relaxed">{ride.pickup_label}</p>
            </div>
          </div>
          <div className="flex min-w-0 gap-3">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="break-words leading-relaxed">{ride.drop_label}</p>
            </div>
          </div>
        </div>
        {(ride.distanceMeters != null || ride.durationSeconds != null) && (
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            {ride.distanceMeters != null && (
              <div>
                <dt className="text-xs text-muted-foreground">Distance</dt>
                <dd className="mt-1 font-bold">{(ride.distanceMeters / 1000).toFixed(1)} km</dd>
              </div>
            )}
            {ride.durationSeconds != null && (
              <div>
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="mt-1 font-bold">
                  {Math.max(1, Math.round(ride.durationSeconds / 60))} min
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
      <div className="[&>section]:mx-0 [&>section]:mb-0">
        <CustomerCollection rideId={ride.id} />
      </div>
      <button
        type="button"
        onClick={onRate}
        className="min-h-12 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
      >
        {ride.rating ? "View your rating" : "Rate your ride"}
      </button>
      <Link
        to="/history"
        className="flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-muted-foreground"
      >
        Your trips
      </Link>
    </section>
  );
}
