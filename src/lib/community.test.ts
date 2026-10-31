import { describe, expect, it } from "vitest";
import { sortCommunityRoutes } from "./community";
import type { CommunityRoute } from "./rides";
const routes = [
  {
    id: "a",
    savings_min: 3,
    safety_score: 90,
    from_lat: 12,
    from_lng: 77,
    created_at: "2026-01-01",
  },
  {
    id: "b",
    savings_min: 8,
    safety_score: 70,
    from_lat: 13,
    from_lng: 78,
    created_at: "2026-02-01",
  },
] as CommunityRoute[];
describe("community route sorting", () => {
  it("sorts savings, safety and newest without changing the source", () => {
    expect(sortCommunityRoutes(routes, "Most saved time", null)[0].id).toBe("b");
    expect(sortCommunityRoutes(routes, "Highest safety", null)[0].id).toBe("a");
    expect(sortCommunityRoutes(routes, "Newest", null)[0].id).toBe("b");
    expect(routes[0].id).toBe("a");
  });
  it("sorts by pickup proximity", () => {
    expect(sortCommunityRoutes(routes, "Near me", { lat: 13, lng: 78 })[0].id).toBe("b");
  });
});
