// Primary: call the RIDEHER backend directly. If the browser blocks the call
// (CORS / network), we transparently retry through our own same-origin proxy
// route, which forwards the caller's bearer token upstream unchanged.
export const API_BASE_URL =
  (import.meta.env["VITE_EXTERNAL_API_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "https://api.rideher.in/api/v1";
const PROXY_API_URL = "/api/public/rh";
let API_URL = API_BASE_URL;

function fallbackToProxy() {
  if (API_URL !== PROXY_API_URL) {
    console.warn("Direct RIDEHER API call blocked; falling back to same-origin proxy.");
    API_URL = PROXY_API_URL;
  }
}

const ACCESS_TOKEN_KEY = "rh_access_token";
const REFRESH_TOKEN_KEY = "rh_refresh_token";
const USER_KEY = "rh_user";

export type AuthUser = {
  id: string;
  role: "CUSTOMER" | "CAPTAIN" | "ADMIN";
  gender: "FEMALE" | "MALE" | "OTHER";
  email: string | null;
  phone: string | null;
  name: string;
  avatarUrl?: string;
  memberSince?: string;
  totalRides?: number;
  totalRating?: number;
  emergencyContact?: { name: string; phone: string };
  address?: string;
  latitude?: number;
  longitude?: number;
  isSuspended: boolean;
};

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type SavedPlaceInput = Omit<SavedPlace, "id">;

export type AuthResponse = {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string };
};

export type ApiError = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

export class RequestError extends Error {
  constructor(
    public status: number,
    public error: ApiError,
  ) {
    super(error.message || `Request failed with status ${status}`);
    this.name = "RequestError";
  }
}

let refreshPromise: Promise<string> | null = null;

function notifyAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rh:auth-changed"));
}

export const storage = {
  getAccessToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: (): AuthUser | null => {
    if (typeof window === "undefined") return null;
    const u = localStorage.getItem(USER_KEY);
    try {
      const parsed: unknown = u ? JSON.parse(u) : null;
      if (!parsed || typeof parsed !== "object") return null;
      const user = parsed as Partial<AuthUser>;
      return typeof user.id === "string" &&
        typeof user.name === "string" &&
        ["CUSTOMER", "CAPTAIN", "ADMIN"].includes(user.role ?? "")
        ? (user as AuthUser)
        : null;
    } catch {
      return null;
    }
  },
  saveAuth: (res: AuthResponse) => {
    if (typeof window === "undefined") return;
    // The backend returns tokens either nested under `tokens` or flat on the root.
    const raw = res as unknown as {
      tokens?: { accessToken?: string; refreshToken?: string };
      accessToken?: string;
      refreshToken?: string;
    };
    const accessToken = raw.tokens?.accessToken ?? raw.accessToken;
    const refreshToken = raw.tokens?.refreshToken ?? raw.refreshToken;
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    notifyAuthChanged();
  },
  saveUser: (user: AuthUser) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      notifyAuthChanged();
    }
  },
  clearAuth: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    notifyAuthChanged();
  },
};

// Keep API code independent of the router while still allowing the app shell
// to return the rider to sign-in as soon as a session can no longer be used.
function expireSession() {
  storage.clearAuth();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rh:session-expired"));
  }
}

async function refreshToken(): Promise<string> {
  const rt = storage.getRefreshToken();
  if (!rt) throw new Error("No refresh token");

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!res.ok) {
    expireSession();
    throw new Error("Refresh failed");
  }

  const data: AuthResponse = await res.json();
  storage.saveAuth(data);
  const token = storage.getAccessToken();
  if (!token) throw new Error("Refresh failed");
  return token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = storage.getAccessToken();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (e: any) {
    // A CORS rejection or network failure surfaces as a TypeError — retry once
    // through the same-origin proxy before giving up.
    if (API_URL !== PROXY_API_URL) {
      fallbackToProxy();
      try {
        response = await fetch(`${PROXY_API_URL}${path}`, { ...init, headers });
      } catch (e2: any) {
        console.error(`API fetch error (${path}):`, e2);
        throw new RequestError(503, {
          code: "FETCH_ERROR",
          message: "Unable to connect to RIDEHER server. Please check your internet connection.",
          requestId: "internal",
        });
      }
    } else {
      console.error(`API fetch error (${path}):`, e);
      throw new RequestError(503, {
        code: "FETCH_ERROR",
        message: "Unable to connect to RIDEHER server. Please check your internet connection.",
        requestId: "internal",
      });
    }
  }

  if (response.status === 401 && storage.getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshToken()
        .catch((error) => {
          expireSession();
          throw error;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    const retryToken = await refreshPromise;

    const retryHeaders = new Headers(init.headers);
    retryHeaders.set("Content-Type", "application/json");
    retryHeaders.set("Authorization", `Bearer ${retryToken}`);

    const retryResponse = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: retryHeaders,
    });

    if (!retryResponse.ok) {
      const errorData = await retryResponse.json().catch(() => ({ message: "Request failed" }));
      if (retryResponse.status === 401) expireSession();
      throw new RequestError(retryResponse.status, errorData);
    }
    return retryResponse.status === 204 ? (undefined as T) : retryResponse.json();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Request failed" }));
    if (response.status === 401) expireSession();
    throw new RequestError(response.status, errorData);
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

// Auth methods
export const authApi = {
  signup: (data: any) =>
    api<AuthResponse>("/auth/signup/customer", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string; expectedRole?: "CUSTOMER" }) =>
    api<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...data, expectedRole: "CUSTOMER" }),
    }),
  // The backend accepts the Google/Supabase token under different key names
  // depending on the endpoint, and its signup/login split is not consistent —
  // try both routes and send every accepted alias.
  google: async (credential: string) => {
    const body = JSON.stringify({
      credential,
      idToken: credential,
      accessToken: credential,
      provider: "google",
    });
    const paths = ["/auth/google", "/auth/signup/google", "/auth/login/google"];
    let lastError: unknown;
    for (const path of paths) {
      try {
        return await api<AuthResponse>(path, { method: "POST", body });
      } catch (e) {
        lastError = e;
        if (e instanceof RequestError && e.status !== 404 && e.status < 500) throw e;
      }
    }
    throw lastError instanceof Error
      ? new RequestError(503, {
          code: "GOOGLE_SIGNIN_UNAVAILABLE",
          message:
            "Google sign-in is temporarily unavailable. Please sign in with your email and password.",
          requestId: "internal",
        })
      : lastError;
  },
  signupGoogle: (credential: string) => authApi.google(credential),
  loginGoogle: (credential: string) => authApi.google(credential),

  logout: () =>
    api("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: storage.getRefreshToken() }),
    }).finally(() => storage.clearAuth()),
  me: () => api<{ user: AuthUser }>("/auth/me"),
};

// Ride methods
export const rideApi = {
  // Returns { ride, paymentIntent? } (newer backend) or { data } (older); use parseCreateRide.
  create: (data: RideRequest, idempotencyKey?: string) =>
    api<any>("/rides/request", {
      method: "POST",
      body: JSON.stringify(data),
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  estimate: (data: {
    pickup: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  }) =>
    api<{ data: RideEstimate }>("/rides/estimate", { method: "POST", body: JSON.stringify(data) }),
  bookingDetails: (id: string) => api<{ data: BookingDetails }>(`/rides/${id}/booking-details`),
  cancel: (id: string, reason: string) =>
    api<{ data: CanonicalRide }>(`/rides/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  history: async () => unwrapList(await api<any>("/rides/history/me")) as RideHistoryItem[],
  rate: (id: string, data: { stars: number; tip?: number; comment?: string }) =>
    api(`/rides/${id}/rate`, { method: "POST", body: JSON.stringify(data) }),
};

export type RideEstimate = {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  polyline: string;
  estimates: Array<{ vehicleType: "BIKE" | "AUTO" | "CAB"; min: number; max: number }>;
};

export const fareApi = {
  estimate: (data: {
    vehicleType: "BIKE" | "AUTO" | "CAB";
    distanceMeters: number;
    durationSeconds: number;
  }) =>
    api<{ data: { min: number; max: number } }>("/fares/estimate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const captainAvailabilityApi = {
  get: (vehicleType?: "BIKE" | "AUTO" | "CAB") =>
    api<{ data: { activeCaptains: number } }>(
      `/captains/availability${vehicleType ? `?vehicleType=${vehicleType}` : ""}`,
    ),
};

export const captainMapApi = {
  get: (lat: number, lng: number, vehicleType?: "BIKE" | "AUTO" | "CAB") =>
    api<{ data: { captains: { lat: number; lng: number; vehicleType: string }[] } }>(
      `/captains/map-captains?lat=${lat}&lng=${lng}${vehicleType ? `&vehicleType=${vehicleType}` : ""}`,
    ),
};

export type CanonicalRideStatus =
  "SEARCHING" | "MATCHED" | "ARRIVING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type RideRequest = {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  vehicleType: "BIKE" | "AUTO" | "CAB";
  paymentMethod: PaymentMethodId;
};

export type PaymentMethodId = "CASH" | "CARD" | "UPI" | "WALLET";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export type PaymentIntent = {
  id?: string;
  status?: PaymentStatus;
  metadata?: { qrCode?: string; upiIntent?: string; checkoutUrl?: string; expiresAt?: string };
};

export type RideHistoryItem = {
  id: string;
  status: CanonicalRideStatus;
  pickupAddress?: string;
  dropAddress?: string;
  fareEstimate?: number;
  fareFinal?: number | null;
  paymentMethod?: PaymentMethodId;
  paymentStatus?: PaymentStatus;
  paymentIntents?: PaymentIntent[];
  vehicleType?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  createdAt?: string;
};

/** Normalise the create-ride response across backend versions. */
export function parseCreateRide(res: any): {
  ride: CanonicalRide;
  paymentIntent: PaymentIntent | null;
} {
  const ride = res?.ride ?? res?.data?.ride ?? res?.data ?? res;
  const paymentIntent = res?.paymentIntent ?? res?.data?.paymentIntent ?? null;
  return { ride, paymentIntent };
}

export function normalizePaymentStatus(res: any): PaymentStatus {
  const d = res?.data ?? res ?? {};
  const raw = String(d.status ?? d.paymentStatus ?? "PENDING").toUpperCase();
  if (raw === "PAID" || raw === "SUCCEEDED" || raw === "SUCCESS" || raw === "CAPTURED")
    return "PAID";
  if (raw === "FAILED") return "FAILED";
  if (raw === "EXPIRED") return "EXPIRED";
  return "PENDING";
}

export const paymentApi = {
  forRide: async (rideId: string) =>
    normalizePaymentStatus(await api<any>(`/payments/ride/${rideId}`)),
};

export type CanonicalRide = RideRequest & {
  id: string;
  status: CanonicalRideStatus;
  fareEstimate: number;
  fareFinal?: number | null;
  distanceMeters: number;
  durationSeconds: number;
  captainId?: string | null;
  // Returned only to the customer who creates the request. The captain never
  // receives this value; they enter it only after the customer shares it.
  otp?: string;
};

export type BookingDetails = {
  rideId: string;
  status: CanonicalRideStatus;
  pickup: { lat: number; lng: number; address: string };
  drop: { lat: number; lng: number; address: string };
  fareEstimate: number;
  distanceMeters: number;
  durationSeconds: number;
  vehicleType: "BIKE" | "AUTO" | "CAB";
  captain: {
    id: string;
    name: string;
    phone: string | null;
    avatarUrl: string | null;
    vehicleType: "BIKE" | "AUTO" | "CAB" | null;
    vehicleNumber: string | null;
    vehicleModel: string | null;
    rating: number | null;
  } | null;
  captainLocation: { lat: number; lng: number } | null;
  customer?: { name?: string; phone?: string | null } | null;
  otp?: string;
};

// User methods
export const userApi = {
  getMe: () => api<{ user: AuthUser }>("/users/me"),
  updateMe: (
    data: Partial<
      Pick<
        AuthUser,
        "name" | "email" | "phone" | "avatarUrl" | "address" | "latitude" | "longitude"
      >
    >,
  ) => api<{ user: AuthUser }>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
  getSavedPlaces: () => api<{ data: SavedPlace[] }>("/users/me/saved-places"),
  addSavedPlace: (data: SavedPlaceInput) =>
    api<{ data: SavedPlace }>("/users/me/saved-places", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSavedPlace: (id: string, data: SavedPlaceInput) =>
    api<{ data: SavedPlace }>(`/users/me/saved-places/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSavedPlace: (id: string) => api<void>(`/users/me/saved-places/${id}`, { method: "DELETE" }),
  getRideHistory: () => api<{ data: any[] }>("/rides/history/me"),
  getProfile: () => api<{ user: AuthUser }>("/users/me"),
  updateProfile: (
    data: Partial<
      Pick<
        AuthUser,
        "name" | "email" | "phone" | "avatarUrl" | "address" | "latitude" | "longitude"
      >
    >,
  ) => api<{ user: AuthUser }>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
};

// Captain methods.
// The RIDEHER backend exposes captain queues under a few different paths
// depending on deployment, so each read tries the known candidates in order and
// keeps the first one that answers.
function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  return res?.data ?? res?.rides ?? res?.items ?? [];
}

async function firstOk<T>(paths: string[], init?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (const p of paths) {
    try {
      return await api<T>(p, init);
    } catch (e) {
      lastError = e;
      if (e instanceof RequestError && (e.status === 404 || e.status === 405)) continue;
      throw e;
    }
  }
  throw lastError;
}

export const captainApi = {
  pending: async () =>
    unwrapList(await firstOk<any>(["/rides/available", "/rides/pending", "/rides/queue"])),
  active: async () =>
    unwrapList(
      await firstOk<any>([
        "/rides?role=captain&status=active",
        "/captains/me/active-rides",
        "/rides/active",
      ]),
    ),
  completed: async () =>
    unwrapList(
      await firstOk<any>([
        "/rides?role=captain&status=COMPLETED",
        "/captains/me/ride-history",
        "/users/me/rides",
      ]),
    ),
  accept: (id: string) =>
    firstOk<any>([`/rides/${id}/accept`, `/rides/${id}`], {
      method: "POST",
      body: JSON.stringify({ status: "ACCEPTED" }),
    }),
  offers: async () => unwrapList(await firstOk<any>(["/rides/offers/me", "/rides/available"])),
  acceptOffer: (id: string) =>
    api<any>(`/rides/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
  arrived: (id: string) =>
    api<any>(`/rides/${id}/arrived`, { method: "POST", body: JSON.stringify({}) }),
  decline: (id: string) =>
    firstOk<any>([`/rides/${id}/reject`, `/rides/${id}/decline`], {
      method: "POST",
      body: JSON.stringify({}),
    }),
  setStatus: (id: string, status: string) =>
    firstOk<any>([`/rides/${id}/status`, `/rides/${id}`], {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  setAvailability: (isAvailable: boolean) =>
    firstOk<any>(["/captains/me/availability", "/captains/me"], {
      method: "PATCH",
      body: JSON.stringify({ isAvailable, status: isAvailable ? "AVAILABLE" : "OFFLINE" }),
    }),
};

// Wallet + vehicle-type availability used by the customer booking flow.
export type VehicleTypeId = "BIKE" | "AUTO" | "CAB";

function parseWalletBalance(res: any): number {
  const d = res?.data ?? res ?? {};
  const raw = d.balance ?? d.amount ?? d.walletBalance ?? d.newBalance ?? d.credits;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export const walletApi = {
  get: async () => ({ balance: parseWalletBalance(await api<any>("/users/me/wallet")) }),
  topup: async (amount: number) => {
    const res = await api<any>("/users/me/wallet/topup", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
    return { balance: parseWalletBalance(res) };
  },
};

// Availability per vehicle type (enabled per city/zone in the admin module).
// Unknown or missing types are treated as available.
function parseVehicleTypes(res: any): Partial<Record<VehicleTypeId, boolean>> {
  const d = res?.data ?? res;
  const out: Partial<Record<VehicleTypeId, boolean>> = {};
  const norm = (v: unknown) => String(v ?? "").toUpperCase();
  const readFlag = (item: any) =>
    item?.available ?? item?.isEnabled ?? item?.enabled ?? item?.isAvailable ?? true;
  if (Array.isArray(d)) {
    for (const item of d) {
      const type = norm(item?.vehicleType ?? item?.type ?? item?.name);
      if (type === "BIKE" || type === "AUTO" || type === "CAB") out[type] = Boolean(readFlag(item));
    }
  } else if (d && typeof d === "object") {
    for (const key of Object.keys(d)) {
      const type = norm(key);
      if (type === "BIKE" || type === "AUTO" || type === "CAB")
        out[type as VehicleTypeId] = Boolean(d[key]);
    }
  }
  return out;
}

export const vehicleTypesApi = {
  get: async () => parseVehicleTypes(await api<any>("/rides/vehicle-types")),
};
