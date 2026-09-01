
// Primary: call the RIDEHER backend directly. If the browser blocks the call
// (CORS / network), we transparently retry through our own same-origin proxy
// route, which forwards the caller's bearer token upstream unchanged.
export const API_BASE_URL =
  (import.meta.env['VITE_EXTERNAL_API_URL'] as string | undefined)?.replace(/\/$/, '') ??
  'https://api.rideher.in/api/v1';
const PROXY_API_URL = '/api/public/rh';
let API_URL = API_BASE_URL;

function fallbackToProxy() {
  if (API_URL !== PROXY_API_URL) {
    console.warn('Direct RIDEHER API call blocked; falling back to same-origin proxy.');
    API_URL = PROXY_API_URL;
  }
}

const ACCESS_TOKEN_KEY = 'rh_access_token';
const REFRESH_TOKEN_KEY = 'rh_refresh_token';
const USER_KEY = 'rh_user';


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
  isSuspended: boolean;
};

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
  constructor(public status: number, public error: ApiError) {
    super(error.message || `Request failed with status ${status}`);
    this.name = 'RequestError';
  }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

export const storage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: (): AuthUser | null => {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  saveAuth: (res: AuthResponse) => {
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
  },
  clearAuth: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function refreshToken(): Promise<string> {
  const rt = storage.getRefreshToken();
  if (!rt) throw new Error('No refresh token');

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!res.ok) {
    storage.clearAuth();
    throw new Error('Refresh failed');
  }

  const data: AuthResponse = await res.json();
  storage.saveAuth(data);
  const token = storage.getAccessToken();
  if (!token) throw new Error('Refresh failed');
  return token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = storage.getAccessToken();
  
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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
          code: 'FETCH_ERROR',
          message: 'Unable to connect to RIDEHER server. Please check your internet connection.',
          requestId: 'internal',
        });
      }
    } else {
      console.error(`API fetch error (${path}):`, e);
      throw new RequestError(503, {
        code: 'FETCH_ERROR',
        message: 'Unable to connect to RIDEHER server. Please check your internet connection.',
        requestId: 'internal',
      });
    }
  }


  if (response.status === 401 && storage.getRefreshToken()) {
    let retryToken: string;
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        retryToken = await refreshToken();
        onRefreshed(retryToken);
      } catch (e) {
        storage.clearAuth();
        throw e;
      } finally {
        isRefreshing = false;
      }
    } else {
      retryToken = await new Promise<string>((resolve) => {
        addRefreshSubscriber(resolve);
      });
    }

    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('Content-Type', 'application/json');
    retryHeaders.set('Authorization', `Bearer ${retryToken}`);

    const retryResponse = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: retryHeaders,
    });

    if (!retryResponse.ok) {
      const errorData = await retryResponse.json().catch(() => ({ message: 'Request failed' }));
      throw new RequestError(retryResponse.status, errorData);
    }
    return retryResponse.status === 204 ? (undefined as T) : retryResponse.json();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new RequestError(response.status, errorData);
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

// Auth methods
export const authApi = {
  signup: (data: any) => api<AuthResponse>('/auth/signup/customer', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ ...data, expectedRole: 'CUSTOMER' }) }),
  signupGoogle: (credential: string) => api<AuthResponse>('/auth/signup/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  loginGoogle: (credential: string) => api<AuthResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  logout: () => api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: storage.getRefreshToken() }) }).finally(() => storage.clearAuth()),
  me: () => api<{ user: AuthUser }>('/auth/me'),
};

// Ride methods
export const rideApi = {
  create: (data: RideRequest) =>
    api<{ data: CanonicalRide }>('/rides/request', { method: 'POST', body: JSON.stringify(data) }),
  bookingDetails: (id: string) => api<{ data: BookingDetails }>(`/rides/${id}/booking-details`),
  cancel: (id: string, reason: string) =>
    api<{ data: CanonicalRide }>(`/rides/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rate: (id: string, data: { stars: number; tip?: number }) =>
    api(`/rides/${id}/rate`, { method: 'POST', body: JSON.stringify(data) }),
};

export const fareApi = {
  estimate: (data: { vehicleType: "BIKE" | "AUTO" | "CAB"; distanceMeters: number; durationSeconds: number }) =>
    api<{ data: { min: number; max: number } }>("/fares/estimate", { method: "POST", body: JSON.stringify(data) }),
};

export const captainAvailabilityApi = {
  get: (vehicleType?: "BIKE" | "AUTO" | "CAB") =>
    api<{ data: { activeCaptains: number } }>(`/captains/availability${vehicleType ? `?vehicleType=${vehicleType}` : ""}`),
};

export const captainMapApi = {
  get: (lat: number, lng: number, vehicleType?: "BIKE" | "AUTO" | "CAB") =>
    api<{ data: { captains: { lat: number; lng: number; vehicleType: string }[] } }>(`/captains/map-captains?lat=${lat}&lng=${lng}${vehicleType ? `&vehicleType=${vehicleType}` : ""}`),
};

export type CanonicalRideStatus =
  | 'SEARCHING'
  | 'MATCHED'
  | 'ARRIVING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type RideRequest = {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  vehicleType: 'BIKE' | 'AUTO' | 'CAB';
  paymentMethod: 'CASH' | 'CARD' | 'UPI';
};

export type CanonicalRide = RideRequest & {
  id: string;
  status: CanonicalRideStatus;
  fareEstimate: number;
  fareFinal?: number | null;
  distanceMeters: number;
  durationSeconds: number;
  captainId?: string | null;
};

export type BookingDetails = {
  rideId: string;
  status: CanonicalRideStatus;
  pickup: { lat: number; lng: number; address: string };
  drop: { lat: number; lng: number; address: string };
  fareEstimate: number;
  distanceMeters: number;
  durationSeconds: number;
  vehicleType: 'BIKE' | 'AUTO' | 'CAB';
  captain: {
    id: string;
    name: string;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
  captainLocation: { lat: number; lng: number } | null;
};

// User methods
export const userApi = {
  getMe: () => api<{ user: AuthUser }>('/users/me'),
  updateMe: (data: any) => api<{ user: AuthUser }>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  getSavedPlaces: () => api<{ data: any[] }>('/users/me/saved-places'),
  addSavedPlace: (data: any) => api<{ data: any }>('/users/me/saved-places', { method: 'POST', body: JSON.stringify(data) }),
  getRideHistory: () => api<{ data: any[] }>('/users/me/rides'),
  getProfile: () => api<{ user: AuthUser }>('/users/me/profile'),
  updateProfile: (data: any) => api<{ user: AuthUser }>('/users/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
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
  pending: async () => unwrapList(await firstOk<any>(['/rides/available', '/rides/pending', '/rides/queue'])),
  active: async () => unwrapList(await firstOk<any>(['/rides?role=captain&status=active', '/captains/me/active-rides', '/rides/active'])),
  completed: async () =>
    unwrapList(await firstOk<any>(['/rides?role=captain&status=COMPLETED', '/captains/me/ride-history', '/users/me/rides'])),
  accept: (id: string) =>
    firstOk<any>([`/rides/${id}/accept`, `/rides/${id}`], {
      method: 'POST',
      body: JSON.stringify({ status: 'ACCEPTED' }),
    }),
  decline: (id: string) =>
    firstOk<any>([`/rides/${id}/reject`, `/rides/${id}/decline`], { method: 'POST', body: JSON.stringify({}) }),
  setStatus: (id: string, status: string) =>
    firstOk<any>([`/rides/${id}/status`, `/rides/${id}`], { method: 'PATCH', body: JSON.stringify({ status }) }),
  setAvailability: (isAvailable: boolean) =>
    firstOk<any>(['/captains/me/availability', '/captains/me'], {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable, status: isAvailable ? 'AVAILABLE' : 'OFFLINE' }),
    }),
};
