import type { CommunityRoute } from "./rides";
export type RouteSort = "All routes" | "Most saved time" | "Highest safety" | "Newest" | "Near me";
export function sortCommunityRoutes(
  routes: CommunityRoute[],
  sort: RouteSort,
  location: { lat: number; lng: number } | null,
) {
  const distance = (route: CommunityRoute) => {
    if (!location) return Infinity;
    const radians = Math.PI / 180;
    const a =
      Math.sin(((route.from_lat - location.lat) * radians) / 2) ** 2 +
      Math.cos(location.lat * radians) *
        Math.cos(route.from_lat * radians) *
        Math.sin(((route.from_lng - location.lng) * radians) / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  };
  return [...routes].sort((a, b) => {
    if (sort === "Most saved time") return b.savings_min - a.savings_min;
    if (sort === "Highest safety") return b.safety_score - a.safety_score;
    if (sort === "Newest")
      return (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0);
    if (sort === "Near me") return distance(a) - distance(b);
    return 0;
  });
}
