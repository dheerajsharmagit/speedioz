import type { MapVehicleType } from "./nearby-captains";

export const vehiclePaths: Record<MapVehicleType, readonly string[]> = {
  BIKE: [
    "M9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    "M21 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    "M6 17l4-7h3l3 7H9M8 10H5l-2 3M13 6h3l3 11M9 10l2-3",
  ],
  AUTO: [
    "M3 16V9l4-5h9l5 8v5h-3M6 17h9M4 9h12l3 4H3M11 9v7",
    "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  ],
  CAB: [
    "M3 16V10l3-5h12l3 5v6h-3M6 16h9M4 10h16M7 5l-1 5M17 5l1 5M6 12h1M17 12h1",
    "M9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  ],
};

export function vehicleMarkerSvg(type: MapVehicleType, count = 1, assigned = false) {
  const paths = vehiclePaths[type] ?? vehiclePaths.BIKE;
  const label =
    count > 99 ? "99+" : String(Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="22" r="16" fill="#000" opacity=".12"/><circle cx="20" cy="20" r="16" fill="${assigned ? "#fff" : "#ffdf38"}" stroke="${assigned ? "#007a53" : "#fff"}" stroke-width="2"/><g transform="translate(8 8)" fill="none" stroke="#1b2028" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>${count > 1 ? `<circle cx="31" cy="9" r="8" fill="#17202b" stroke="#fff"/><text x="31" y="12" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="9" fill="#fff">${label}</text>` : assigned ? '<circle cx="31" cy="9" r="6" fill="#007a53" stroke="#fff"/><path d="m28 9 2 2 4-4" stroke="#fff" stroke-width="1.5" fill="none"/>' : ""}</svg>`;
}
export const vehicleMarkerUrl = (type: MapVehicleType, count = 1, assigned = false) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleMarkerSvg(type, count, assigned))}`;
