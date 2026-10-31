// Razorpay server functions. App-internal RPC used by the ride payment step
// and the wallet top-up dialog. Key material is read inside .handler() only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { razorpayCreateOrder, razorpayFetchPayment, verifyRazorpaySignature } from "./razorpay.server";

export type RazorpayOrderResult =
  | { ok: true; keyId: string; orderId: string; amount: number; currency: string }
  | { ok: false; error: string };

const orderInput = z.object({
  // Rupees; Razorpay takes paise.
  amount: z.number().min(1).max(100000),
  description: z.string().max(200).optional(),
});

export const createRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => orderInput.parse(data))
  .handler(async ({ data }): Promise<RazorpayOrderResult> => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) return { ok: false, error: "RAZORPAY_NOT_CONFIGURED" };
    const amountPaise = Math.round(data.amount * 100);
    try {
      const order = await razorpayCreateOrder(keyId, keySecret, {
        amountPaise,
        // Razorpay caps receipts at 40 chars.
        receipt: `rh_${Date.now()}`.slice(0, 40),
        description: data.description,
      });
      return {
        ok: true,
        keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      };
    } catch (e) {
      console.error("Razorpay order creation failed:", e);
      return { ok: false, error: "RAZORPAY_ORDER_FAILED" };
    }
  });

export type RazorpayConfirmResult =
  | { ok: true; paymentId: string; amount: number }
  | { ok: false; error: string };

const confirmInput = z.object({
  orderId: z.string().min(5).max(80),
  paymentId: z.string().min(5).max(80),
  signature: z.string().min(5).max(200),
  // Expected amount in paise — must match what the customer actually paid.
  expectedAmount: z.number().int().positive(),
});

export const confirmRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => confirmInput.parse(data))
  .handler(async ({ data }): Promise<RazorpayConfirmResult> => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) return { ok: false, error: "RAZORPAY_NOT_CONFIGURED" };

    // 1) Offline check: the checkout handler's signature proves the payment id
    //    and order id pair came from Razorpay.
    if (!verifyRazorpaySignature(data.orderId, data.paymentId, data.signature, keySecret)) {
      return { ok: false, error: "SIGNATURE_MISMATCH" };
    }
    // 2) Online check: ask Razorpay for the payment itself and make sure it
    //    really succeeded for the expected amount.
    try {
      const payment = await razorpayFetchPayment(keyId, keySecret, data.paymentId);
      const captured = payment.status === "captured" || payment.status === "authorized";
      if (!captured) {
        return { ok: false, error: `PAYMENT_${payment.status.toUpperCase()}` };
      }
      if (payment.amount !== data.expectedAmount) {
        return { ok: false, error: "AMOUNT_MISMATCH" };
      }
      return { ok: true, paymentId: payment.id, amount: payment.amount };
    } catch (e) {
      console.error("Razorpay payment verification failed:", e);
      return { ok: false, error: "VERIFICATION_UNAVAILABLE" };
    }
  });
