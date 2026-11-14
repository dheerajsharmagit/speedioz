// Server-only Razorpay helpers. Never import from client code — this module
// is excluded from client bundles by the *.server.ts naming convention.
import { createHmac, timingSafeEqual } from "crypto";

export async function forwardPaymentRequest(
  path: "/payments/intent" | "/payments/confirm",
  token: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; status: number; json?: string; error?: string }> {
  const base = (
    process.env["RIDEHER_API_BASE_URL"] ??
    process.env["VITE_EXTERNAL_API_URL"] ??
    "https://api.rideher.in/api/v1"
  ).replace(/\/+$/, "");
  const versioned = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  try {
    const response = await fetch(`${versioned}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    return response.ok
      ? { ok: true, status: response.status, json: JSON.stringify(result.data) }
      : {
          ok: false,
          status: response.status,
          error: result.message ?? "Unable to process this ride payment",
        };
  } catch {
    return { ok: false, status: 502, error: "The payment service is temporarily unavailable" };
  }
}

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function razorpayAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

/** razorpay_signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type RazorpayOrder = {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
  receipt?: string;
};

export type RazorpayPayment = {
  id: string;
  status: string;
  amount: number; // paise
  currency: string;
  order_id: string;
  method?: string;
};

async function razorpayFetch(
  keyId: string,
  keySecret: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: razorpayAuthHeader(keyId, keySecret),
      ...(init?.headers ?? {}),
    },
  });
}

export async function razorpayCreateOrder(
  keyId: string,
  keySecret: string,
  input: {
    amountPaise: number;
    receipt: string;
    description?: string;
    notes?: Record<string, string>;
  },
): Promise<RazorpayOrder> {
  const res = await razorpayFetch(keyId, keySecret, "/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay order creation failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return (await res.json()) as RazorpayOrder;
}

export async function razorpayFetchPayment(
  keyId: string,
  keySecret: string,
  paymentId: string,
): Promise<RazorpayPayment> {
  const res = await razorpayFetch(keyId, keySecret, `/payments/${encodeURIComponent(paymentId)}`);
  if (!res.ok) {
    throw new Error(`Razorpay payment lookup failed (${res.status})`);
  }
  return (await res.json()) as RazorpayPayment;
}
