# Fix: Google Maps not visible on the ride page

## What I verified first

- The reported `src/lib/utils.ts(8,7)` TypeScript error is stale: that file is 6 lines long and has no typed assignment. The latest build log shows no errors. Nothing to fix there.
- The Google Maps script itself loads fine in this environment: on `/ride`, `window.google.maps` is present, `gm_authFailure` never fires, and there are no console errors.
- I could not reproduce the blank map end to end because `/ride` redirects to `/auth` without a signed-in session, and no preview session is available to the test browser right now. So the exact cause is unconfirmed — the plan starts by confirming it.

## Likely cause (unconfirmed)

The map is created once, immediately after the Google script resolves. If the map container has zero or near-zero size at that instant (bottom sheet still laying out, tab/step transition, mobile viewport), Google Maps initialises into a collapsed box and then never redraws, which shows as a blank grey panel even though the API loaded successfully. There is currently no container-size observation, no re-init when the container becomes non-zero, and no visible reason shown to the user when the map stays empty.

A second possibility, which the same work covers: the map initialises before the pickup coordinates resolve, centering on a default point with nothing recognisable in view.

## Plan

1. **Confirm the cause.** Sign in to the preview so `/ride` is reachable, then check, in the live page, whether the map container reports a non-zero width/height at init and whether Google's own tile markup (`.gm-style`) exists inside it. This decides between "collapsed container" and "map never constructed".
2. **Make the map resilient to container size.** Observe the map container with a `ResizeObserver`; when it changes from zero to a real size, trigger a Google Maps resize and re-fit the current bounds. Retry construction if the container was zero-sized when the script resolved.
3. **Defer/refresh the initial center.** Ensure the map recenters and refits once real pickup coordinates arrive, so it never sits on a placeholder location.
4. **Never show a silent blank panel.** If the map has loaded but produced no tiles within a short window, fall back to the existing Leaflet backup map (already implemented) and show the existing "Using backup map / Retry" pill, so the page always shows something usable.
5. **Verify.** Re-test `/ride` signed in at mobile and desktop widths: map visible on first paint, visible after switching booking steps, pickup/drop markers and route line drawn, and no new console errors. Also confirm the build passes.

## Technical notes

- Changes are limited to `src/components/rc/RideMap.tsx` and, if the container CSS is implicated, the map wrapper in `src/routes/ride.tsx` (currently `relative min-h-[360px] flex-1` with the map as `absolute inset-0`).
- No changes to booking logic, the `api.rideher.in` integration, socket events, the Places search fix, the API key, or the UI design.
- The Leaflet fallback, the retry/backoff loader, and the `gm_authFailure` hook stay as they are; this only adds the missing "loaded but not painted" path.
- If step 1 instead shows an authentication/referrer failure on your published or custom domain, I will report that separately, since a Lovable-managed Maps key only works on `*.lovable.app` domains and needs your own key for a custom domain.
