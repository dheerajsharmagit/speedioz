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
