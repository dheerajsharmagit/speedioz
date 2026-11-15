import { describe, expect, it } from "vitest";
import {
  canShowNearbyCaptains,
  isCaptainTracking,
  mapVehicleType,
  normalizeNearbyAvailability,
  visibleNearbyCaptains,
} from "./nearby-captains";
import { vehicleMarkerSvg } from "./vehicle-markers";

const points = [{ lat: 12.972, lng: 77.641, vehicleType: "BIKE" as const, count: 3 }];
describe("nearby captain display boundaries", () => {
  it("shows nearby captains while choosing a pickup, vehicle or payment method", () => {
    for (const step of ["destination", "vehicle", "confirm"])
      expect(
        canShowNearbyCaptains({ step, hasRide: false, creating: false, recovering: false }),
      ).toBe(true);
  });
  it("hides nearby captains as soon as booking starts, before a ride response arrives", () => {
    expect(
      canShowNearbyCaptains({ step: "confirm", hasRide: false, creating: true, recovering: false }),
    ).toBe(false);
    expect(
      canShowNearbyCaptains({
        step: "destination",
        hasRide: false,
        creating: false,
        recovering: true,
      }),
    ).toBe(false);
  });
  it.each(["payment", "searching", "matched", "arriving", "inprogress", "completed", "rating"])(
    "never shows unassigned captains in %s",
    (step) => {
      expect(
        canShowNearbyCaptains({ step, hasRide: true, creating: false, recovering: false }),
      ).toBe(false);
    },
  );
  it("keeps only the assigned captain even if a map caller accidentally passes both kinds", () => {
    expect(visibleNearbyCaptains(points, { lat: 12.97, lng: 77.64 })).toEqual([]);
    expect(visibleNearbyCaptains(points, null)).toBe(points);
    expect(isCaptainTracking("searching")).toBe(false);
    expect(isCaptainTracking("matched")).toBe(true);
  });
  it("keeps cab markers distinct and maps legacy EV bikes to BIKE", () => {
    expect(mapVehicleType("cab")).toBe("CAB");
    expect(mapVehicleType("auto")).toBe("AUTO");
    expect(mapVehicleType("ev")).toBe("BIKE");
    expect(vehicleMarkerSvg("CAB")).not.toBe(vehicleMarkerSvg("BIKE"));
  });
  it("preserves real zero counts and rejects incomplete, negative or inconsistent responses", () => {
    const empty = {
      captains: [],
      counts: { BIKE: 0, AUTO: 0, CAB: 0 },
      total: 0,
      radiusKm: 6,
      updatedAt: "now",
    };
    expect(normalizeNearbyAvailability(empty).counts.BIKE).toBe(0);
    expect(() => normalizeNearbyAvailability({ captains: [] })).toThrow(/unavailable/);
    expect(() => normalizeNearbyAvailability({ ...empty, total: 2 })).toThrow(/unavailable/);
    expect(() =>
      normalizeNearbyAvailability({ ...empty, counts: { BIKE: -1, AUTO: 0, CAB: 0 }, total: -1 }),
    ).toThrow(/unavailable/);
  });
  it("drops invalid coordinates and makes marker counts safe for SVG rendering", () => {
    const result = normalizeNearbyAvailability({
      captains: [...points, { ...points[0], lat: 500 }],
      counts: { BIKE: 3, AUTO: 0, CAB: 0 },
      total: 3,
      radiusKm: 6,
      updatedAt: "now",
    });
    expect(result.captains).toEqual(points);
    expect(vehicleMarkerSvg("BIKE", 200)).toContain("99+");
    expect(vehicleMarkerSvg("BIKE", Number.NaN)).not.toContain("NaN");
  });
});
