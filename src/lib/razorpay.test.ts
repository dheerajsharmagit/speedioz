import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpaySignature } from "./razorpay.server";

const SECRET = "test_razorpay_secret";

function sign(orderId: string, paymentId: string): string {
  return createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

describe("razorpay signature verification", () => {
  it("accepts a signature Razorpay produced", () => {
    expect(verifyRazorpaySignature("order_123", "pay_456", sign("order_123", "pay_456"), SECRET)).toBe(
      true,
    );
  });

  it("rejects a signature computed over tampered values", () => {
    expect(verifyRazorpaySignature("order_999", "pay_456", sign("order_123", "pay_456"), SECRET)).toBe(
      false,
    );
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyRazorpaySignature("order_123", "pay_456", sign("order_123", "pay_456"), "other")).toBe(
      false,
    );
  });

  it("rejects empty or missing signatures", () => {
    expect(verifyRazorpaySignature("order_123", "pay_456", "", SECRET)).toBe(false);
  });
});
