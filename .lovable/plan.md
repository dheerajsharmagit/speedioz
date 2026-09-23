# Editable customer profile and saved addresses

## Goal
Let customers edit their personal details and manage address/location details directly from the profile page, with an option to open each saved location for navigation.

## Changes
- Replace the inactive Edit link with an in-page profile editor for name, email, mobile number, and avatar URL.
- Save profile changes through the existing RIDEHER user profile endpoint and keep the local signed-in profile synchronized.
- Turn Saved Places into a working section that loads existing addresses and supports adding, editing, and deleting Home, Work, or custom locations.
- Capture an address plus latitude and longitude, and provide an “Open directions” action that launches the selected place in Google Maps.
- Add clear loading, validation, success, empty, and error states without changing unrelated profile features.
- Correct the reported TypeScript issue if it is reproducible; the current `src/lib/utils.ts` contains only the class-name helper and the latest build reports no error there.

## Technical details
- Use the existing `/users/me` and `/users/me/saved-places` API integration, adding typed saved-place update/delete methods only if supported by the existing API contract.
- Reuse the project’s semantic colors and existing form/button patterns.
- Add complete social metadata to the profile route and verify the profile page on desktop and mobile widths.
