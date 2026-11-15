import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NearbyCaptains } from "./NearbyCaptains";
const base = {
  type: "BIKE" as const,
  count: 0,
  loading: false,
  failed: false,
  pickupConfirmed: true,
  onRetry() {},
};
describe("nearby captain status", () => {
  it("distinguishes a real zero from loading and a failed availability check", () => {
    expect(renderToStaticMarkup(<NearbyCaptains {...base} />)).toContain("0 bike captains nearby");
    const failed = renderToStaticMarkup(<NearbyCaptains {...base} count={null} failed />);
    expect(failed).toContain("Nearby captains unavailable");
    expect(failed).not.toContain("0 bike captains");
    expect(renderToStaticMarkup(<NearbyCaptains {...base} count={null} loading />)).toContain(
      "Finding nearby captains",
    );
  });
  it("shows one assigned captain rather than the old nearby total during a ride", () => {
    const html = renderToStaticMarkup(<NearbyCaptains {...base} count={12} assigned />);
    expect(html).toContain("1 captain assigned");
    expect(html).toContain("Waiting for captain location");
    expect(html).not.toContain("12 bike");
  });
});
