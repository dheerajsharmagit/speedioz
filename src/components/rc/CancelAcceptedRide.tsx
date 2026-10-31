import { useState } from "react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function CancelAcceptedRide({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Cancellation was not confirmed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-6 mb-6">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) {
            setOpen(next);
            setError("");
          }
        }}
      >
        <AlertDialogTrigger className="h-12 w-full rounded-full border border-destructive/40 text-sm font-bold text-destructive">
          Cancel ride
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this ride?</AlertDialogTitle>
            <AlertDialogDescription>
              Your captain has accepted the booking. You can cancel before the trip starts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep ride</AlertDialogCancel>
            <button
              disabled={busy}
              onClick={() => void confirm()}
              className="h-10 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {busy ? "Cancelling…" : "Yes, cancel ride"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
