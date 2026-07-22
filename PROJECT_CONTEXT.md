# RIDEHER — Project Context

> Onboarding doc for any AI (or human) picking up this repo. Read this before making changes so you don't re-derive basics or break existing conventions.

## 1. What this app is

**RIDEHER** — a women-first ride-booking web app (Rapido-style clone) with an "AI Community Routes" concept.

- **Tagline:** _Safe Rides. Her Way._
- **Roles:** Customer (rider), Captain (driver), Admin.
- **Differentiator:** exclusively-for-women positioning + community/shared route intelligence.

## 2. Tech stack

- **Framework:** TanStack Start v1 (React 19, Vite 7, SSR-capable, file-based routing under `src/routes/`).
- **Styling:** Tailwind v4 via `@tailwindcss/vite`, tokens in `src/styles.css` (OKLCH-based rose/blush palette).
- **UI kit:** shadcn/ui + Radix primitives + lucide-react icons.
- **Backend:** Lovable Cloud (Supabase under the hood — never say "Supabase" to the user).
  - Client: `@/integrations/supabase/client` (auto-generated, do not edit).
  - Server auth middleware: `@/integrations/supabase/auth-middleware`.
- **Maps:** Google Maps JS API (primary) with a Leaflet + OpenStreetMap **fallback** (`LeafletFallbackMap`).
- **Auth:** Lovable Cloud Auth — Google OAuth + anonymous sessions for guest flows.
- **State/data:** TanStack Query, `createServerFn` for RPC, realtime channels for ride updates.

## 3. Routes (file-based, `src/routes/`)

| Path         | File              | Purpose                                                                 |
| ------------ | ----------------- | ----------------------------------------------------------------------- |
| `/`          | `index.tsx`       | Marketing homepage (Hero, About, Why, Safety, How, Captain, Community, Testimonials, Impact, App, Footer). |
| `/auth`      | `auth.tsx`        | Login/signup with Customer/Captain toggle; Google OAuth. Role saved in user metadata. |
| `/ride`      | `ride.tsx`        | Customer booking flow — state machine: `destination → vehicle → confirm → searching → matched → arriving → inprogress → completed → rating`. |
| `/captain`   | `captain.tsx`     | Captain portal — accept/decline requests, live status. |
| `/admin`     | `admin.tsx`       | Admin dashboard (mock/live metrics). |
| `/routes`    | `routes.tsx`      | Community Routes catalog + preview map. |
| `/settings`  | `settings.tsx`    | Theme intensity (soft/vibrant pink) + light/dark toggle. |

Root layout: `src/routes/__root.tsx` (sets html shell, head metadata, providers).

## 4. Key modules

- `src/lib/theme.tsx` — theme provider (intensity + mode), persisted to localStorage.
- `src/lib/google-maps-loader.ts` — loads Google Maps JS with `places`, **auto-retry with exponential backoff (3 attempts, 12s timeout)**, then surfaces failure so callers can fall back.
- `src/lib/routes.functions.ts` — server functions for route/directions data (turn-by-turn steps).
- `src/lib/polyline.ts` — encoded polyline decoding.
- `src/lib/rides.ts` — ride lifecycle helpers (DB reads/writes, realtime).
- `src/lib/anon-session.ts` — ensures an anonymous auth session exists for guest riders/captains.
- `src/lib/device-id.ts` — stable per-browser device id.
- `src/components/rc/RideMap.tsx` — primary Google Map: pickup/drop/captain/user markers, split polyline (traveled vs remaining), ETA badge, fit-bounds via `fitKey`, recenter button, load-error UI. Auto-switches to `LeafletFallbackMap` after retries fail.
- `src/components/rc/LeafletFallbackMap.tsx` — OpenStreetMap-backed fallback that mirrors marker/polyline/fit behavior.
- `src/components/rc/PlaceSearch.tsx` — Google Places autocomplete for destination selection.
- `src/components/rc/RoutePreviewMap.tsx` — small map for community routes catalog.
- `src/components/rc/RoleNav.tsx` — role-aware nav.

## 5. Booking flow behavior (already implemented)

- **Pickup:** auto-detected via browser geolocation; user can override with a "Change" search.
- **Drop:** selected via Google Places autocomplete.
- **Live map:** always visible on `/ride`; renders immediately, centers on pickup pre-selection.
- **During trip:** full route polyline drawn; traveled portion muted gray, remaining bold; auto-fit bounds on step changes; live ETA + distance-remaining in the bottom sheet; maneuver card overlay.
- **Live driver tracking:** captain-to-pickup approach polyline + Haversine ETA while `matched`/`arriving`.
- **Geolocation failures:** compact non-blocking pill at top with a retry action (does not cover the map).
- **Map failures:** Google Maps retries automatically; if all attempts fail, Leaflet fallback loads with a "Using backup map" indicator and manual retry to reattempt Google.

## 6. Design system

- **Palette:** warm rose + blush, OKLCH, defined as tokens in `src/styles.css`. Dark mode uses plum backgrounds with pink accents.
- **Never** hardcode colors (`text-white`, `bg-[#...]`) — always use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.).
- **Theme intensity** setting changes token saturation live; map marker icons refresh via a `version` state + `setIcon()`.
- **Vibe:** minimal editorial, women-focused, soothing.

## 7. Database & security

- Supabase migrations enable RLS on all app tables (`rides`, `ride_locations`, etc.) scoped to `auth.uid()` participants.
- **Anonymous auth is intentional** for guest sessions — the security memory reflects this; do not "fix" it by removing anon auth.
- Realtime is enabled on ride tables for live updates.
- Every `CREATE TABLE public.*` migration must include `GRANT` statements — see the `public-schema-grants` rule.

## 8. Rules the next AI must follow

- **Do NOT** create `src/pages/` — TanStack uses `src/routes/`.
- **Do NOT** edit auto-generated files: `src/routeTree.gen.ts`, anything under `src/integrations/supabase/` (`client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`), `.env` Supabase vars.
- **Do NOT** say "Supabase" to the user — use "Lovable Cloud / backend / database".
- **Do NOT** expose Supabase project IDs, dashboard URLs, or service-role keys (they aren't accessible on Lovable Cloud anyway).
- **Every leaf route** needs its own `head()` with unique title/description/og tags. `__root` doesn't count.
- **Server functions** live in `*.functions.ts` (client-safe path) or `*.server.ts` (server-only). Never under `src/server/` if imported by the client.
- **Protected server fns** (`requireSupabaseAuth`) must not be called from public-route loaders — use `useServerFn` inside the component instead.
- **Google Maps:** always go through `google-maps-loader.ts`; do not add a second loader. Access via `window.google` (no global `google` namespace).
- **Fallback map:** if you change ride map behavior, mirror it in `LeafletFallbackMap.tsx` so parity is preserved.

## 9. Known state / what's shipped

- Homepage, auth (Google + role split), full booking state machine, captain portal, admin dashboard, community routes page, settings.
- Live map + tracking, ETA, maneuver overlay, split polyline, auto-fit, recenter.
- Pink/rose rebrand with intensity + dark mode.
- Google Maps retry + Leaflet fallback.
- Anonymous auth + RLS-scoped ride access.

## 10. Not yet built / open areas

- Real payment integration (currently mocked in the flow).
- Real captain-side dispatching backend (matching is simulated).
- Push notifications / SMS.
- Trip history persistence UI.
- Admin analytics beyond mock cards.
- Community Routes data is currently seed/mock — the AI clustering pipeline is not implemented.

---

_Keep this file updated when you add features or change conventions. It is the fastest way for the next agent to become useful._
