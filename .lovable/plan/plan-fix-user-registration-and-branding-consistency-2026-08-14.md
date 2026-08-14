# Plan: Fix User Registration and Branding Consistency

The user requested to "check the user registration process" and provided a directive to avoid visual modifications unless required. This plan focuses on ensuring the registration flow works correctly and that branding is consistent with the "RIDEHER" name (replacing any leftover "RideConnect" references).

## User Review Required

> [!IMPORTANT]
> - Ensure you have configured Google Auth in the backend settings if you intend to use it.
> - The registration currently uses Supabase Auth with an anonymous session fallback for instant use.

## Proposed Changes

### 1. Branding Consistency
- Update `/auth` page to use "RIDEHER" instead of "RideConnect".
- Update `/captain` page to use "RIDEHER" in the head title.
- Update `RoleNav` component to ensure navigation labels are clear.

### 2. Registration Flow Fixes
- Ensure the `/auth` page correctly handles role selection ("rider" vs "captain") and persists it during the Supabase sign-up process.
- Fix the `applyRole` logic to ensure metadata is synced immediately upon successful sign-up/sign-in.
- Verify that the `ensureAnonSession` helper doesn't conflict with real user sessions.

### 3. Navigation & UX
- Ensure "Register" and "Login" buttons on the landing page point to the correct `/auth` state.
- Update the `/auth` page to clearly distinguish between Customer and Captain registration.

## Technical Details

- **File**: `src/routes/auth.tsx`
  - Replace "RideConnect" with "RIDEHER".
  - Refine `handleEmail` and `handleGoogle` to ensure `user_metadata.role` is consistently set.
- **File**: `src/routes/index.tsx`
  - Ensure "Register" button in `nav` passes a state or hash if needed (defaulting to signup mode).
- **File**: `src/routes/captain.tsx`
  - Update `head` metadata title.
- **File**: `src/components/rc/RoleNav.tsx`
  - Ensure labels match the app's terminology ("Customer" instead of just "Ride").

## Verification Plan

- **Automated**: Run a Playwright script to:
  1. Navigate to `/auth`.
  2. Toggle between Customer and Captain roles.
  3. Verify the "Create account" button text updates.
  4. Mock a successful registration and verify redirect to `/ride` or `/captain`.
- **Manual**: Verify the landing page buttons correctly lead to the auth page.
