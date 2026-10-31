# RIDEHER frontend

React 19 and TypeScript application using TanStack Start, Vite, Tailwind, shadcn UI, Leaflet/Google Maps, and Socket.IO. The production API is `https://api.rideher.in/api/v1`; its implementation is maintained separately.

## Local development

Use Node 24 (minimum 22.12). Install with `npm ci --legacy-peer-deps`, then run `npm run dev`. The legacy peer resolver is required by the current dependency tree. npm is the verified package manager; the older bun lockfile is not used by CI.

Copy required public configuration into a local `.env.local`: `VITE_EXTERNAL_API_URL` optionally overrides the API URL; `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configure Lovable/Supabase OAuth. Never put service-role credentials in VITE variables. Routing optionally uses server-only `LOVABLE_API_KEY` and `GOOGLE_MAPS_API_KEY`, otherwise OSRM fallback. The same-origin API proxy targets the production RIDEHER API.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint` (repository-wide legacy formatting and explicit-any violations remain; not yet a passing CI gate)

GitHub Actions checks types, unit/regression tests, and the production build. Tests mock network responses and do not validate production backend behavior or charge real payments.

## Implemented flows and limits

Customer email login/signup, Google OAuth handoff, place search, estimates, ride requests, payment-status polling, booking recovery from ride history, trip tracking, history, saved places, profile editing, and theme preferences use existing API integration. Customer recovery depends on history returning active rides. Captain and admin screens verify roles through `/auth/me`; backend authorization must enforce permissions independently.

Captain availability waits for server confirmation. Active trips restore via the existing captain active-rides API and refresh from booking details. OTP/start/completion controls require a confirmed backend contract and are not simulated. Live admin metrics/moderation are unavailable until operations APIs are connected. Secure wallet top-up is unavailable until provider checkout is connected.

Community routes can be sorted by reported savings, safety, date, and pickup proximity. Map previews use the supplied geometry. Booking does not claim community-route selection or fabricated time savings. Submission, verification, and AI scoring require backend implementation.

Trip details can be shared using native sharing or copied as text. This does not create a live tracking link or SOS alert. Emergency contacts and emergency dispatch require backend support.

A web manifest and service worker provide an offline notice. Accounts, API responses, payments, and locations are never cached for offline use. Full offline booking is not supported.

See [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md) for backend contracts, security fixes, migration requirements, and integration tests still needed. Database migrations in this frontend repository do not establish the security of the external API. No remote database changes are applied by frontend builds.

## Lovable

Connected to Lovable. Preserve published Git history; do not force-push or rewrite already pushed commits. Changes pushed to the connected branch sync into the Lovable editor.
