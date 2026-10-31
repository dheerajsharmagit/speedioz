import { useState } from "react";
import type { Ride } from "@/lib/rides";

export function RideSafety({ ride }: { ride: Ride }) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState("");
  async function share() {
    const text = `My RIDEHER trip ${ride.id}: ${ride.pickup_label} to ${ride.drop_label}. Captain: ${ride.captain_name ?? "Not assigned"}. Vehicle: ${ride.captain_plate ?? "Not available"}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My ride details", text });
        setMessage("Ride details shared.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setMessage("Ride details copied. Send them to someone you trust.");
      } else {
        setFallback(text);
        setMessage("Copy these details and send them to someone you trust.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFallback(text);
      setMessage("Sharing unavailable. Copy the details below.");
    }
  }
  return (
    <section className="mx-6 mb-6 space-y-3 rounded-2xl border p-4" aria-label="Ride safety">
      <a
        href={ride.captain_phone ? `tel:${ride.captain_phone}` : undefined}
        aria-disabled={!ride.captain_phone}
        className={`block text-sm font-semibold ${ride.captain_phone ? "text-primary" : "text-muted-foreground"}`}
      >
        {ride.captain_phone ? "Call captain" : "Captain phone unavailable"}
      </a>
      <button
        className="h-11 w-full rounded-full border text-sm font-semibold"
        onClick={() => void share()}
      >
        Share ride details
      </button>
      <p className="text-xs text-muted-foreground">
        Shares trip details only. Live sharing and in-app SOS are unavailable. In an emergency,
        contact local emergency services directly.
      </p>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
      {fallback && (
        <textarea
          aria-label="Ride details to copy"
          readOnly
          value={fallback}
          className="w-full rounded border bg-background p-2 text-xs"
        />
      )}
    </section>
  );
}
