import { afterEach, describe, expect, it, vi } from "vitest";
import { rideApi, type CanonicalRide, type BookingDetails, type RideHistoryItem } from "./api";
import { cancelRideConfirmed, loadCustomerActiveRide, cancelAcceptedRide } from "./booking";
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

describe("accepted ride cancellation", () => {
  it.each(["MATCHED", "ARRIVING"] as const)(
    "cancels a %s ride through the server",
    async (status) => {
      vi.spyOn(rideApi, "bookingDetails").mockResolvedValue({
        data: { rideId: "ride", status } as BookingDetails,
      });
      const cancel = vi
        .spyOn(rideApi, "cancel")
        .mockResolvedValue({ data: { status: "CANCELLED" } as CanonicalRide });
      await expect(cancelAcceptedRide("ride")).resolves.toBeUndefined();
      expect(cancel).toHaveBeenCalledWith("ride", "Cancelled by customer before trip started");
    },
  );
  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED", "SEARCHING"] as const)(
    "does not cancel a ride that changed to %s",
    async (status) => {
      vi.spyOn(rideApi, "bookingDetails").mockResolvedValue({
        data: { rideId: "ride", status } as BookingDetails,
      });
      const cancel = vi.spyOn(rideApi, "cancel");
      await expect(cancelAcceptedRide("ride")).rejects.toThrow("status has changed");
      expect(cancel).not.toHaveBeenCalled();
    },
  );
  it("keeps cancellation unsuccessful when the server rejects it", async () => {
    vi.spyOn(rideApi, "bookingDetails").mockResolvedValue({
      data: { status: "MATCHED" } as BookingDetails,
    });
    vi.spyOn(rideApi, "cancel").mockRejectedValue(new Error("Cancellation rejected"));
    await expect(cancelAcceptedRide("ride")).rejects.toThrow("Cancellation rejected");
  });
});
