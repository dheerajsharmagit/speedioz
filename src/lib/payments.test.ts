import { describe, expect, it } from "vitest";
import {
  defaultPaymentMethod,
  needsOnlinePayment,
  secondsUntil,
  razorpayCheckoutDetails,
  razorpayConfirmation,
} from "./payments";
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
    expect(normalizePaymentStatus({ data: { status: "REFUNDED" } })).toBe("REFUNDED");
  });
  it("uses the backend checkout amount and rejects incomplete or non-Razorpay orders", () => {
    expect(
      razorpayCheckoutDetails({
        provider: "razorpay",
        providerIntentId: "order_fixture",
        amount: 6400,
        currency: "INR",
        metadata: { keyId: "rzp_test_fixture", mode: "test" },
      }),
    ).toMatchObject({ amount: 6400, orderId: "order_fixture", mode: "test" });
    expect(() => razorpayCheckoutDetails({ provider: "razorpay", amount: 6400 })).toThrow(
      "not ready",
    );
    expect(() =>
      razorpayCheckoutDetails({
        provider: "stripe",
        orderId: "order_fixture",
        keyId: "rzp_test_fixture",
        amount: 6400,
        currency: "INR",
      }),
    ).toThrow("not ready");
  });
  it("sends the server order and signed callback without a client-supplied fare", () => {
    const callback = {
      razorpay_order_id: "order_fixture",
      razorpay_payment_id: "pay_fixture",
      razorpay_signature: "signed",
    };
    expect(razorpayConfirmation("ride", "order_fixture", callback)).toEqual({
      rideId: "ride",
      providerIntentId: "order_fixture",
      paymentId: "pay_fixture",
      signature: "signed",
    });
    expect(() => razorpayConfirmation("ride", "order_other", callback)).toThrow(
      "unexpected payment",
    );
  });
});
