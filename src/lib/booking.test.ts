import { afterEach, describe, expect, it, vi } from "vitest";
import { rideApi, type CanonicalRide, type BookingDetails, type RideHistoryItem } from "./api";
import { cancelRideConfirmed, loadCustomerActiveRide } from "./booking";
afterEach(() => vi.restoreAllMocks());
describe("booking recovery and cancellation", () => {
  it("restores active rides, ignoring completed history", async () => {
    vi.spyOn(rideApi, "history").mockResolvedValue([
      { id: "old", status: "COMPLETED" },
      { id: "current", status: "IN_PROGRESS" },
    ] as RideHistoryItem[]);
    const details = { rideId: "current", status: "IN_PROGRESS" } as BookingDetails;
    const read = vi.spyOn(rideApi, "bookingDetails").mockResolvedValue({ data: details });
    expect((await loadCustomerActiveRide())?.details).toBe(details);
    expect(read).toHaveBeenCalledWith("current");
  });
  it("returns no active booking for empty history", async () => {
    vi.spyOn(rideApi, "history").mockResolvedValue([]);
    expect(await loadCustomerActiveRide()).toBeNull();
  });
  it("propagates recovery failure so booking can remain blocked", async () => {
    vi.spyOn(rideApi, "history").mockRejectedValue(new Error("Offline"));
    await expect(loadCustomerActiveRide()).rejects.toThrow("Offline");
  });
  it("requires server-confirmed cancellation", async () => {
    const cancel = vi
      .spyOn(rideApi, "cancel")
      .mockResolvedValue({ data: { status: "IN_PROGRESS" } as CanonicalRide });
    await expect(cancelRideConfirmed("ride", "customer request")).rejects.toThrow(
      "Cancellation not confirmed",
    );
    cancel.mockResolvedValue({ data: { status: "CANCELLED" } as CanonicalRide });
    await expect(cancelRideConfirmed("ride", "customer request")).resolves.toBeUndefined();
  });
  it("does not hide transport errors on cancellation", async () => {
    vi.spyOn(rideApi, "cancel").mockRejectedValue(new Error("Offline"));
    await expect(cancelRideConfirmed("ride", "customer request")).rejects.toThrow("Offline");
  });
});
