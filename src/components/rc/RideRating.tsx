import { useRef, useState, type FormEvent } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { rideApi, type SavedRideRating } from "@/lib/api";

const descriptions = ["Choose a rating", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function RideRating({
  rideId,
  captainName,
  initialRating,
  onSaved,
  onDone,
}: {
  rideId: string;
  captainName: string;
  initialRating?: SavedRideRating | null;
  onSaved?: (rating: SavedRideRating) => void;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [tip, setTip] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedRideRating | null>(null);
  const submitting = useRef(false);
  const submitted = saved ?? initialRating;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || submitted || stars < 1 || stars > 5) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await rideApi.rate(rideId, {
        stars,
        tip: tip || undefined,
        comment: comment.trim() || undefined,
      });
      setSaved(result.data);
      onSaved?.(result.data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to submit your rating. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (submitted)
    return (
      <section
        aria-label="Rating saved"
        className="min-w-0 rounded-3xl border border-border bg-card p-5 text-center sm:p-6"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Check aria-hidden="true" className="size-7" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Thanks for your feedback</h2>
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Your {submitted.stars}-star rating has been saved.
        </p>
        <p className="mt-3 break-words text-sm font-semibold">{captainName}</p>
        <div
          className="my-5 flex justify-center gap-2"
          aria-label={`${submitted.stars} out of 5 stars`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              aria-hidden="true"
              className={`size-6 ${n <= submitted.stars ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onDone}
          className="min-h-12 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
        >
          Done
        </button>
      </section>
    );

  return (
    <section
      aria-labelledby="ride-rating-title"
      className="min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Ride completed
        </p>
        <h2 id="ride-rating-title" className="mt-2 text-2xl font-extrabold tracking-tight">
          Rate your ride
        </h2>
        <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
          How was your ride with{" "}
          <span className="font-semibold text-foreground">{captainName}</span>?
        </p>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <fieldset disabled={busy}>
          <legend className="sr-only">Choose a rating from 1 to 5 stars</legend>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="min-w-0 cursor-pointer">
                <input
                  type="radio"
                  name={`ride-rating-${rideId}`}
                  value={n}
                  checked={stars === n}
                  onChange={() => setStars(n)}
                  aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                  className="peer sr-only"
                />
                <span
                  className={`grid min-h-12 place-items-center rounded-2xl border transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${n <= stars ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground"}`}
                >
                  <Star
                    aria-hidden="true"
                    className={`size-6 ${n <= stars ? "fill-current" : ""}`}
                  />
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-center text-sm font-semibold" aria-live="polite">
            {descriptions[stars]}
          </p>
        </fieldset>
        <fieldset disabled={busy}>
          <legend className="mb-2 text-sm font-semibold">
            Tip for your captain{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {[0, 10, 20, 50].map((amount) => (
              <button
                key={amount}
                type="button"
                aria-pressed={tip === amount}
                onClick={() => setTip(amount)}
                className={`min-h-11 rounded-xl border px-1 text-sm font-semibold ${tip === amount ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
              >
                {amount ? `₹${amount}` : "None"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Give any tip directly to your captain. Submitting feedback does not collect a tip.
          </p>
        </fieldset>
        <div>
          <label htmlFor={`comment-${rideId}`} className="text-sm font-semibold">
            Your feedback <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id={`comment-${rideId}`}
            value={comment}
            disabled={busy}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tell us about your ride"
            rows={3}
            className="mt-2 block w-full resize-y rounded-2xl border border-border bg-background p-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {error && (
          <p
            role="alert"
            className="break-words rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!stars || busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {busy ? "Submitting…" : error ? "Retry rating" : "Submit rating"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDone}
          className="min-h-11 w-full rounded-xl px-3 text-sm font-semibold text-muted-foreground disabled:opacity-50"
        >
          Maybe later
        </button>
      </form>
    </section>
  );
}
