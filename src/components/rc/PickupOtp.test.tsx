import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PickupOtp, shouldShowPickupOtp } from "./PickupOtp";
describe("persistent pickup OTP", () => {
  it("keeps the code through captain acceptance and arrival until the server confirms trip start", () => {
    for (const status of ["MATCHED", "ARRIVING", "matched", "arriving", "accepted"])
      expect(shouldShowPickupOtp(status)).toBe(true);
    for (const status of ["SEARCHING", "IN_PROGRESS", "inprogress", "COMPLETED", "CANCELLED"])
      expect(shouldShowPickupOtp(status)).toBe(false);
    expect(renderToStaticMarkup(<PickupOtp otp="8329" />)).toContain("8329");
  });
  it("does not invent an OTP if the server has not returned one", () => {
    const html = renderToStaticMarkup(<PickupOtp otp="" />);
    expect(html).toContain("••••");
    expect(html).toContain("captain verifies it and starts the ride");
  });
});
