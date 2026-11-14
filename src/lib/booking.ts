import { rideApi } from "./api";

/** Late polling/socket replies must not bring pickup and its OTP back after start. */
export function canApplyRideProgress(current: string, incoming: string): boolean {
  const pickup = ["searching", "matched", "arriving"];
  if (["inprogress", "completed", "rating"].includes(current) && pickup.includes(incoming)) return false;
  if (["completed", "rating"].includes(current) && incoming === "inprogress") return false;
  return true;
}

export async function loadCustomerActiveRide() {
  const history = await rideApi.history();
  if (!Array.isArray(history)) throw new Error("Invalid ride history");
  const active = history.find((item) =>
    ["SEARCHING", "MATCHED", "ARRIVING", "IN_PROGRESS"].includes(item.status),
  ) ?? history.find(item => ["COMPLETED", "RATED"].includes(item.status) && item.paymentStatus === "PENDING");
  if (!active) return null;
  const response = await rideApi.bookingDetails(active.id);
  return { history: active, details: response.data };
}

export async function cancelRideConfirmed(id: string, reason: string) {
  const response = await rideApi.cancel(id, reason);
  if (response.data?.status !== "CANCELLED") throw new Error("Cancellation not confirmed");
}

/** Recheck server state so a stale pickup screen cannot cancel a started trip. */
export async function cancelAcceptedRide(id: string) {
  const { data } = await rideApi.bookingDetails(id);
  if (data.status !== "MATCHED" && data.status !== "ARRIVING") {
    throw new Error("This ride can no longer be cancelled before pickup. Its status has changed.");
  }
  await cancelRideConfirmed(id, "Cancelled by customer before trip started");
}
