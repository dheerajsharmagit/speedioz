import { ChevronDown, MapPin, Star } from "lucide-react";
import { useState } from "react";
import type { RideHistoryItem, SavedRideRating } from "@/lib/api";
import { CustomerCollection } from "./CustomerCollection";
import { RideRating } from "./RideRating";

const statusLabel: Record<string, string> = {
  SEARCHING: "Searching",
  MATCHED: "Matched",
  ARRIVING: "Arriving",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  RATED: "Completed",
  CANCELLED: "Cancelled",
};
const money = (amount: number | null | undefined) =>
  amount == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount);

export function TripHistoryCard({
  ride,
  expanded,
  onToggle,
}: {
  ride: RideHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [rating, setRating] = useState<SavedRideRating | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const completed = ["COMPLETED", "RATED"].includes(ride.status);
  const savedRating = rating ?? ride.rating;
  const date = ride.createdAt ? new Date(ride.createdAt) : null;
  const dateLabel =
    date && Number.isFinite(date.getTime())
      ? date.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Trip details";
  return (
    <article className="min-w-0 rounded-3xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`trip-${ride.id}`}
        className="block w-full min-w-0 rounded-3xl p-4 text-left focus-visible:outline-2 focus-visible:outline-ring sm:p-5"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs">
          <span className="min-w-0 break-words text-muted-foreground">{dateLabel}</span>
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${completed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            {statusLabel[ride.status] ?? ride.status}
          </span>
        </div>
        <div className="mt-4 flex min-w-0 gap-3">
          <div className="flex w-4 shrink-0 flex-col items-center pt-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-primary" />
            <span className="my-1 min-h-6 w-px flex-1 bg-border" />
            <MapPin className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1 space-y-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Pickup</p>
              <p className="break-words leading-relaxed">
                {ride.pickupAddress || "Pickup unavailable"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Destination</p>
              <p className="break-words font-semibold leading-relaxed">
                {ride.dropAddress || "Destination unavailable"}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {ride.vehicleType && (
              <span className="rounded-lg bg-muted px-2 py-1">{ride.vehicleType}</span>
            )}
            {ride.paymentMethod && <span>{ride.paymentMethod}</span>}
            {ride.paymentStatus && (
              <span className="break-words">
                {ride.paymentStatus === "PAID"
                  ? "Paid"
                  : ride.paymentStatus.toLowerCase().replaceAll("_", " ")}
              </span>
            )}
            {ride.paymentMode === "test" && <span className="text-amber-600">Test payment</span>}
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="break-words text-lg font-extrabold">
              {money(ride.fareFinal ?? ride.fareEstimate)}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`size-4 shrink-0 transition ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>
      {expanded && (
        <div id={`trip-${ride.id}`} className="min-w-0 space-y-4 border-t border-border p-4 sm:p-5">
          <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-4 text-sm">
            <Detail
              label="Distance"
              value={
                ride.distanceMeters != null ? `${(ride.distanceMeters / 1000).toFixed(1)} km` : "—"
              }
            />
            <Detail
              label="Duration"
              value={
                ride.durationSeconds != null ? `${Math.round(ride.durationSeconds / 60)} min` : "—"
              }
            />
            <Detail label="Estimated fare" value={money(ride.fareEstimate)} />
            <Detail label="Final fare" value={money(ride.fareFinal)} />
            {ride.paymentProvider && (
              <Detail
                label="Payment provider"
                value={ride.paymentProvider === "razorpay" ? "Razorpay" : ride.paymentProvider}
              />
            )}
          </dl>
          {completed && (
            <>
              <div className="min-w-0 [&>section]:mx-0 [&>section]:mb-0">
                <CustomerCollection rideId={ride.id} />
              </div>
              {ratingOpen ? (
                <RideRating
                  rideId={ride.id}
                  captainName="your captain"
                  initialRating={savedRating}
                  onSaved={setRating}
                  onDone={() => setRatingOpen(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setRatingOpen(true)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
                >
                  <Star aria-hidden="true" className="size-4 text-primary" />
                  {savedRating ? `Your rating · ${savedRating.stars}/5` : "Rate this ride"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}
