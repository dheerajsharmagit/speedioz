export type MapVehicleType = "BIKE" | "AUTO" | "CAB";
export type NearbyCaptain = {
  lat: number;
  lng: number;
  vehicleType: MapVehicleType;
  count: number;
};
export type NearbyAvailability = {
  captains: NearbyCaptain[];
  counts: Record<MapVehicleType, number>;
  total: number;
  radiusKm: number;
  updatedAt: string;
  markersLimited?: boolean;
};
export const mapVehicleType = (selected: string): MapVehicleType =>
  selected.toLowerCase() === "auto" ? "AUTO" : selected.toLowerCase() === "cab" ? "CAB" : "BIKE";
export const mapVehicleName = (type: MapVehicleType) =>
  type === "BIKE" ? "bike" : type === "AUTO" ? "auto" : "cab";
export const isMapPosition = (point: unknown): point is { lat: number; lng: number } => {
  const value = point as { lat?: number; lng?: number } | null;
  return (
    !!value &&
    Number.isFinite(value.lat) &&
    Math.abs(value.lat!) <= 90 &&
    Number.isFinite(value.lng) &&
    Math.abs(value.lng!) <= 180
  );
};
export const canShowNearbyCaptains = (state: {
  step: string;
  hasRide: boolean;
  creating: boolean;
  recovering: boolean;
}) =>
  !state.hasRide &&
  !state.creating &&
  !state.recovering &&
  ["destination", "vehicle", "confirm"].includes(state.step);
export const isCaptainTracking = (step: string) =>
  ["matched", "arriving", "inprogress"].includes(step);
export const visibleNearbyCaptains = (
  captains: readonly NearbyCaptain[],
  assigned?: { lat: number; lng: number } | null,
) => (assigned ? [] : captains);

export function normalizeNearbyAvailability(value: unknown): NearbyAvailability {
  const data = value as Partial<NearbyAvailability> | null;
  const counts = data?.counts;
  if (
    !data ||
    !Array.isArray(data.captains) ||
    !counts ||
    ![counts.BIKE, counts.AUTO, counts.CAB, data.total].every(
      (count) => Number.isSafeInteger(count) && count! >= 0,
    ) ||
    data.total !== counts.BIKE + counts.AUTO + counts.CAB ||
    !Number.isFinite(data.radiusKm) ||
    data.radiusKm! <= 0
  ) {
    throw new Error("Nearby captain availability is unavailable. Please retry.");
  }
  return {
    ...data,
    counts,
    total: data.total!,
    radiusKm: data.radiusKm!,
    updatedAt: data.updatedAt ?? "",
    captains: data.captains.filter(
      (captain) =>
        isMapPosition(captain) &&
        ["BIKE", "AUTO", "CAB"].includes(captain.vehicleType) &&
        Number.isSafeInteger(captain.count) &&
        captain.count > 0,
    ),
  };
}
