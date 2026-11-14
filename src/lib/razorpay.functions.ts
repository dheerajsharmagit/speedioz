// Compatibility RPCs: the backend owns orders, fares, verification and secrets.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const common = { token: z.string().min(1), rideId: z.string().min(1) };
export const createRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ ...common, paymentMethod: z.enum(["UPI", "CARD"]) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { forwardPaymentRequest } = await import("./razorpay.server");
    return forwardPaymentRequest("/payments/intent", data.token, {
      rideId: data.rideId,
      paymentMethod: data.paymentMethod,
    });
  });
export const confirmRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        ...common,
        orderId: z.string().min(1),
        paymentId: z.string().min(1),
        signature: z.string().min(1),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { forwardPaymentRequest } = await import("./razorpay.server");
    return forwardPaymentRequest("/payments/confirm", data.token, {
      rideId: data.rideId,
      providerIntentId: data.orderId,
      paymentId: data.paymentId,
      signature: data.signature,
    });
  });
