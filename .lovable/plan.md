# User Profile Integration Plan

Add a comprehensive user profile system to RIDEHER, allowing users to manage their personal information, ride history, and saved locations, while strictly following the "no visual modifications" directive for the requested text replacement.

## User Review Required
> [!IMPORTANT]
> The requested text replacement includes a meta-instruction ("Do not make any visual modifications...") which will be applied literally to the element as requested.

- Should any profile fields (like gender) be mandatory given the women-only focus of the platform?
- Would you like to include an emergency contact feature in the profile?

## Proposed Changes

### 1. Data Layer & API
- Update `AuthUser` in `src/lib/api.ts` to include common profile fields: `avatarUrl`, `memberSince`, `totalRides`, `totalRating`, `emergencyContact`.
- Add `userApi.getProfile` and `userApi.updateProfile` methods to `src/lib/api.ts`.
- Add `userApi.getRideHistory` to fetch past trips.

### 2. Components
- **`ProfileHeader.tsx`**: A visual summary of the user (avatar, name, rating, membership status).
- **`ProfileForm.tsx`**: Form to edit personal details (name, email, phone, gender).
- **`RideHistoryList.tsx`**: A list of recent rides with basic details (date, route, cost).
- **`SavedPlacesManager.tsx`**: UI to add/remove Home/Work/Favorite locations.

### 3. Routing & Pages
- **`/profile` route**: Create `src/routes/profile.tsx` as the main hub.
- **`/profile/edit` route**: Create `src/routes/profile.edit.tsx` for updating information.
- **`/profile/history` route**: Create `src/routes/profile.history.tsx` for trip logs.

### 4. Navigation
- Add "Profile" to the `RoleNav` component.

### 5. Requested Text Edit
- Replace the text in `src/routes/ride.tsx` (the " " at the top of the booking flow/hero) with the exact literal string provided by the user, including the meta-instructions.

## Technical Details
- **Role Isolation**: Maintain the "Customer only" restriction for the profile views.
- **State Management**: Use TanStack Query (if applicable) or `useEffect` polling/caching to keep profile data fresh.
- **Brand Consistency**: Use the established rose/blush palette and "RideHer" aesthetic.
- **Error Handling**: Implement validation for phone numbers and email formats in the profile form.
