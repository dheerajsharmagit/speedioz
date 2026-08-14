# Plan: Integrate api.rideher.in Backend

Migrate RIDEHER from the internal mock/Supabase data flow to the external `api.rideher.in` production backend, ensuring a seamless experience for riders and captains while maintaining women-first policies.

## User Review Required

> [!IMPORTANT]
> - **API Base URL:** I will use `https://api.rideher.in/api/v1` based on the documentation.
> - **Auth Scope:** The external backend handles tokens (`accessToken`/`refreshToken`). I will store these in `localStorage` for now to enable session persistence across page loads.
> - **CORS:** Ensure your backend includes `https://speedioz.lovable.app` and preview URLs in `CORS_ORIGINS`.

## Proposed Changes

### Integration Logic
- Create `src/lib/api.ts` to wrap fetch with bearer token injection and `401` auto-refresh logic.
- Implement auth methods: `signup/login` (email/password) and `signup/google`.

### Authentication
- Update `src/routes/auth.tsx` to call the external API instead of Supabase Auth.
- Save returned `AuthResponse` tokens and user profile to local state/storage.

### Ride Lifecycle
- Refactor `src/routes/ride.tsx` to use external endpoints:
    - `POST /rides` to create a booking.
    - `GET /rides/:id` for status polling (or keep Realtime if the backend supports it, otherwise poll).
    - `PATCH /captains/location` (for captain tracking).
- Map mock/simulation logic to real API calls.

### Profiles & Settings
- Update profile fetching to use `GET /users/me`.
- Ensure gender `FEMALE` enforcement is handled via the backend's `409` conflict responses.

## Technical Details

- **Client:** `fetch`-based wrapper with interceptors.
- **Refresh Flow:**
    1. Intercept `401`.
    2. Call `POST /auth/refresh` with stored `refreshToken`.
    3. Retry original request once.
- **Environment:** Add `VITE_EXTERNAL_API_URL=https://api.rideher.in` to `.env` (handled internally).

## Verification Plan

### Automated Tests
- Run `vitest` on `src/lib/api.ts` to verify token injection and error handling (mocking `fetch`).

### Manual Verification
- Attempt Google Sign-in and verify tokens are received from the external API.
- Create a ride and verify the request reaches `POST https://api.rideher.in/api/v1/rides`.
- Check console for `409` or `401` handling.
