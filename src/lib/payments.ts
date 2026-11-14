export type ClientPayment = "wallet" | "upi" | "card" | "cash";

/** Wallet is the default only when its balance covers the whole fare; otherwise UPI. */
export function defaultPaymentMethod(walletBalance: number | null, fare: number): ClientPayment {
  return walletBalance != null && walletBalance >= fare ? "wallet" : "upi";
}

/** UPI and Card need an online payment before matching; Wallet and Cash go straight to matching. */
export function needsOnlinePayment(method: ClientPayment): boolean {
  return method === "upi" || method === "card";
}

export function toServerPayment(method: ClientPayment): "WALLET" | "UPI" | "CARD" | "CASH" {
  return method.toUpperCase() as "WALLET" | "UPI" | "CARD" | "CASH";
}

/** Seconds left until expiry (never negative). */
export function secondsUntil(expiresAt: string | undefined, now = Date.now()): number {
  if (!expiresAt) return 15 * 60;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return 15 * 60;
  return Math.max(0, Math.floor((t - now) / 1000));
}

/** Checkout always uses the amount and order returned by the ride backend. */
export function razorpayCheckoutDetails(intent: import("./api").PaymentIntent) {
  const keyId =
    intent.keyId ?? intent.publicKey ?? intent.metadata?.keyId ?? intent.metadata?.publicKey;
  const orderId = intent.orderId ?? intent.metadata?.orderId ?? intent.providerIntentId;
  const amount = intent.amount ?? intent.metadata?.amount;
  const currency = intent.currency ?? intent.metadata?.currency;
  if (
    intent.provider !== "razorpay" ||
    !keyId?.startsWith("rzp_") ||
    !orderId?.startsWith("order_") ||
    !Number.isSafeInteger(amount) ||
    Number(amount) <= 0 ||
    currency !== "INR"
  )
    throw new Error("Secure checkout is not ready. Retry or contact support.");
  return {
    keyId,
    orderId,
    amount: amount as number,
    currency,
    mode: intent.mode ?? intent.metadata?.mode,
  };
}

export function razorpayConfirmation(
  rideId: string,
  orderId: string,
  callback: import("./razorpay").RazorpayHandlerResponse,
) {
  if (
    callback.razorpay_order_id !== orderId ||
    !callback.razorpay_payment_id ||
    !callback.razorpay_signature
  )
    throw new Error(
      "Checkout returned an unexpected payment. Check payment status before retrying.",
    );
  return {
    rideId,
    providerIntentId: orderId,
    paymentId: callback.razorpay_payment_id,
    signature: callback.razorpay_signature,
  };
}
