// Client-side Razorpay Checkout loader. The checkout script is browser-only,
// so it is injected lazily from event handlers — never during SSR.

export type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const RAZORPAY_CHECKOUT_DISMISSED = "CHECKOUT_DISMISSED";

type RazorpayOptions = {
  key: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss: () => void };
};

type RazorpayInstance = { open: () => void; on: (event: string, cb: (resp: unknown) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let checkoutPromise: Promise<void> | null = null;

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout is browser-only"));
  }
  if (window.Razorpay) return Promise.resolve();
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutPromise = null;
      reject(new Error("Failed to load Razorpay checkout"));
    };
    document.head.appendChild(script);
  });
  return checkoutPromise;
}

export async function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency?: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
}): Promise<RazorpayHandlerResponse> {
  await loadRazorpayCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Razorpay checkout unavailable");

  return new Promise<RazorpayHandlerResponse>((resolve, reject) => {
    const rz = new Razorpay({
      key: opts.keyId,
      amount: opts.amount,
      currency: opts.currency ?? "INR",
      name: opts.name,
      description: opts.description,
      order_id: opts.orderId,
      prefill: opts.prefill,
      theme: { color: opts.themeColor ?? "#e0356e" },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error(RAZORPAY_CHECKOUT_DISMISSED)),
      },
    });
    rz.open();
  });
}
