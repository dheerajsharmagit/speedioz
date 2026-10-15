import { describe, expect, it } from "vitest";
import { defaultPaymentMethod, needsOnlinePayment, secondsUntil } from "./payments";
import { normalizePaymentStatus } from "./api";

describe("payment rules", () => {
  it("defaults to wallet when balance covers the fare", () => {
    expect(defaultPaymentMethod(100, 85)).toBe("wallet");
    expect(defaultPaymentMethod(85, 85)).toBe("wallet");
  });
  it("does not default to wallet when balance is short", () => {
    expect(defaultPaymentMethod(50, 85)).toBe("upi");
    expect(defaultPaymentMethod(null, 85)).toBe("upi");
  });
  it("only UPI and Card require the payment screen", () => {
    expect(needsOnlinePayment("upi")).toBe(true);
    expect(needsOnlinePayment("card")).toBe(true);
    expect(needsOnlinePayment("wallet")).toBe(false);
    expect(needsOnlinePayment("cash")).toBe(false);
  });
  it("payment window falls back to 15 minutes", () => {
    expect(secondsUntil(undefined)).toBe(900);
    expect(secondsUntil("2026-01-01T00:01:00Z", Date.parse("2026-01-01T00:00:00Z"))).toBe(60);
    expect(secondsUntil("2026-01-01T00:00:00Z", Date.parse("2026-01-01T00:05:00Z"))).toBe(0);
  });
  it("reads payment status", () => {
    expect(normalizePaymentStatus({ data: { status: "PAID" } })).toBe("PAID");
    expect(normalizePaymentStatus({ status: "expired" })).toBe("EXPIRED");
    expect(normalizePaymentStatus({})).toBe("PENDING");
  });
});
