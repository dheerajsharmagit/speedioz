import { describe, expect, it } from "vitest";
import { mergeTrackingFix, trackingPhase, trackingIsFresh, trackingTarget } from "./live-tracking";
const now = Date.parse("2026-11-16T10:00:30Z");
const current = { lat: 0, lng: 77, at: "2026-11-16T10:00:28Z", receivedAt: now - 1000 };
describe("live customer tracking", () => {
  it("tracks pickup until verified trip start, then tracks the destination", () => {
    const pickup = { lat: 12, lng: 77 },
      drop = { lat: 13, lng: 78 };
    for (const step of ["matched", "arriving"])
      expect(trackingTarget(trackingPhase(step), pickup, drop)).toBe(pickup);
    expect(trackingTarget(trackingPhase("inprogress"), pickup, drop)).toBe(drop);
    for (const step of ["destination", "searching", "completed", "rating", "cancelled"])
      expect(trackingPhase(step)).toBeNull();
  });
  it("keeps newer socket GPS when an older poll completes later", () => {
    expect(
      mergeTrackingFix(current, { lat: 13, lng: 78, at: "2026-11-16T10:00:20Z" }, now - 5000, now),
    ).toBe(current);
    expect(mergeTrackingFix(current, { lat: 13, lng: 78 }, now, now)).toBe(current);
  });
  it("accepts fresh coordinates including latitude zero and ignores duplicate events", () => {
    const value = { lat: 0, lng: 78, at: new Date(now).toISOString() };
    const fix = mergeTrackingFix(current, value, now, now)!;
    expect(fix).toMatchObject(value);
    expect(mergeTrackingFix(fix, value, now, now)).toBe(fix);
  });
  it("never invents a location or upgrades a timestamp-less location to live", () => {
    expect(mergeTrackingFix(null, null, now, now)).toBeNull();
    expect(trackingIsFresh(mergeTrackingFix(null, { lat: 12, lng: 77 }, now, now), now)).toBe(
      false,
    );
    expect(mergeTrackingFix(current, null, now, now)).toBe(current);
  });
  it.each([
    { lat: NaN, lng: 77 },
    { lat: 91, lng: 77 },
    { lat: 12, lng: Infinity },
    { lat: 12, lng: -181 },
    { lat: "12", lng: 77 },
    { lat: 12, lng: 77, at: new Date(now + 10000).toISOString() },
  ])("ignores invalid or future GPS %j", (value) => {
    expect(mergeTrackingFix(current, value, now, now)).toBe(current);
  });
  it("retains a stale last-known marker while marking the feed delayed", () => {
    expect(trackingIsFresh(current, now)).toBe(true);
    expect(trackingIsFresh(current, now + 30000)).toBe(false);
  });
});
