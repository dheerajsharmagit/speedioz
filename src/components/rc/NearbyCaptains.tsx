import { mapVehicleName, type MapVehicleType } from "@/lib/nearby-captains";
import { vehiclePaths } from "@/lib/vehicle-markers";

export function VehicleSymbol({
  type,
  className = "h-5 w-5",
}: {
  type: MapVehicleType;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {vehiclePaths[type].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function NearbyCaptains({
  type,
  count,
  radiusKm = 6,
  loading,
  failed,
  pickupConfirmed,
  assigned = false,
  hasLocation = false,
  onRetry,
}: {
  type: MapVehicleType;
  count: number | null;
  radiusKm?: number;
  loading: boolean;
  failed: boolean;
  pickupConfirmed: boolean;
  assigned?: boolean;
  hasLocation?: boolean;
  onRetry: () => void;
}) {
  const label = assigned
    ? "1 captain assigned"
    : !pickupConfirmed
      ? "Choose your pickup"
      : failed
        ? "Nearby captains unavailable"
        : loading || count === null
          ? "Finding nearby captains…"
          : `${count} ${mapVehicleName(type)} captain${count === 1 ? "" : "s"} nearby`;
  return (
    <div className="absolute left-4 top-24 z-[1000] flex max-w-[calc(100%-5.5rem)] items-center gap-2.5 rounded-2xl border border-border/60 bg-card/95 px-3 py-2.5 text-foreground shadow-lg backdrop-blur">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-secondary">
        <VehicleSymbol type={type} />
      </span>
      <div className="min-w-0">
        <p role="status" aria-live="polite" className="text-xs font-bold">
          {label}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {assigned
            ? hasLocation
              ? "Tracking your captain"
              : "Waiting for captain location"
            : !pickupConfirmed
              ? "Set a pickup to check availability"
              : failed
                ? "You can retry or continue booking"
                : `Within ${radiusKm} km · approximate locations`}
        </p>
        {!assigned && failed && (
          <button type="button" onClick={onRetry} className="mt-1 text-[11px] font-bold underline">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
