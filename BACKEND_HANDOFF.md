# Prompt for the RIDEHER backend AI

You maintain the backend serving https://api.rideher.in/api/v1. Inspect the actual repository, database migrations, payment integrations, deployment configuration, and tests before changing code. Fix the following in sequence with regression tests. Preserve existing working clients and published Git history. Do not replace real integrations with mocks or trust frontend role/status/payment claims. Do not deploy destructive migrations or run real payment tests.

## 1. Establish and publish the contract

- Confirm the production base URL is api.rideher.in.
- Produce current OpenAPI 3.1 JSON and a concise FRONTEND_HANDOFF.md, including request/response examples, auth requirements, error codes, and exact Socket.IO namespaces, event payloads, room rules, reconnect behavior, and token refresh strategy.
- Existing frontend uses /auth/login, /auth/signup/customer, /auth/refresh, /auth/logout, /auth/me, /users/me, /users/me/saved-places, /rides/request, /rides/estimate, /rides/:id/booking-details, /rides/:id/cancel, /rides/history/me, /rides/:id/rate, /payments/ride/:id, /captains/me/availability, /rides/offers/me, /rides/:id/accept, /rides/:id/arrived, /community-routes, /users/me/wallet, and /users/me/wallet/topup. Verify each against implementation; document discrepancies instead of guessing aliases.
- Current success shapes include {user,tokens:{accessToken,refreshToken}}, {data:...}, and create-ride {ride,paymentIntent}. Standardize with backward compatibility. Errors: {code,message,requestId,details?}.

## 2. Booking identity and concurrency

- Enforce Idempotency-Key on ride creation, scoped to the authenticated customer. Store request fingerprint and result atomically; identical retries return the same ride/payment intent; changed payload with the same key returns a conflict. Document TTL.
- Enforce at most one active ride per customer and captain transactionally. Race two accepts: exactly one captain wins. Enforce valid state transitions on the server.
- Provide an authenticated active-ride recovery endpoint for customer and captain that includes canonical status, assigned party, payment status/intent, route, and allowed next actions. Return an explicit empty result when no active ride exists.
- Make cancellation idempotent and authoritative. Handle cancellation racing acceptance, completion, and payment confirmation. Return the resulting state; reconcile refunds exactly once where required.

## 3. Authentication and access control

- Support customer, captain, and admin login using expectedRole as a constraint, never as a privilege grant. Provision captain/admin roles through trusted onboarding/admin mechanisms only. Require approved captain documents before availability or acceptance. Enforce suspension.
- Remove any hardcoded OTP acceptance such as 1234. Implement actual phone verification with provider delivery, hashed challenges, expiry, resend cooldown, attempt limits, and abuse controls. Never mark phone/gender/identity verified based on client claims.
- Rotate refresh tokens securely, revoke on logout, detect reuse, and document concurrent-refresh behavior. Do not log tokens, passwords, or OTPs.
- Authorize every REST endpoint and socket room/event using verified identity and assignment. Never expose rider OTP in captain responses or offer broadcasts.

## 4. Complete captain trip lifecycle

- Implement or document exact supported endpoints for OTP verification/start, completion, and captain cancellation. Do not use a generic unrestricted status update.
- Enforce SEARCHING -> MATCHED -> ARRIVING -> IN_PROGRESS -> COMPLETED, with explicit permitted cancellation/redispatch transitions. Only the assigned, approved captain can perform captain transitions. OTP validation starts the trip atomically.
- Recover active trips after reload and reconnect. Emit committed state changes to authorized participants only, with rideId, canonical status, and a monotonic version/timestamp.
- Document existing events: rider namespace currently listens for ride:matched, captain:location, ride:searching, ride:arriving, ride:started, ride:completed, ride:cancelled. Captain namespace /captain currently uses status:toggle, location:update, ride:request, ride:accepted, ride:cancelled_by_rider, ride:otp_verified. Correct and publish the actual contract.

## 5. Payments and wallet

- Server calculates fare; use integer minor units and document units. Initiate real provider checkout for UPI/card and topups. Never credit a wallet merely because the client posts an amount.
- Verify signed webhooks, deduplicate events, check amount/currency/order/owner, and apply wallet/ride state changes atomically with an immutable ledger.
- Match online-paid rides only after verified PAID status. A missing intent must never silently bypass payment. Document cash and wallet matching rules separately.
- Provide resumable payment intent/status for active-ride recovery. Distinguish FAILED, EXPIRED, PAID, and PENDING, including late success after expiry/cancellation. Expiry does not prove no debit occurred.
- Implement idempotent refunds and reconciliation for paid rides with no captain or cancelled rides. Test provider callbacks with signed sandbox fixtures, not live charges.

## 6. Safety and contacts

- Persist validated emergency contacts for the authenticated user. Provide authorized, expiring and revocable ride-sharing links that reveal only necessary information.
- Implement SOS incident recording, location context, acknowledgement, escalation, audit logging, and abuse protection. Clearly distinguish backend incident creation from contacting emergency services; do not claim emergency dispatch without an actual integration.
- Document rider/captain contact or masked-call capabilities and access restrictions. Define location retention and sharing expiry.

## 7. Database security

- Inspect any deployed Supabase tables public.rides and public.ride_locations and all RLS policies. Existing frontend migrations allow every authenticated user to read searching rides including OTP, claim them without captain-role verification, and update sensitive fields.
- Remove unrestricted queue access and client mutation of OTP, fare, assignment, payment, and trip status. Put transitions behind trusted transactional server operations; keep participant reads least-privileged. A rider must not spoof captain GPS.
- Migrate without losing ride history; include rollback instructions and SQL authorization tests for anonymous, unrelated customer, rider, unapproved captain, assigned captain, and admin.

## 8. Admin operations

- Implement authenticated, role-authorized metrics and paginated bookings, captain approval, suspension, support cases, payment/refund review, and community-route moderation using actual database data.
- Record actor, reason, timestamp, and before/after state for privileged mutations. Add admin MFA if supported. Return empty metrics when empty, never fabricated live statistics.

## 9. Community route intelligence

- Implement route submission with actual GPS geometry and provenance, unique captain voting, recorded successful trip usage, and admin moderation.
- Define safety/legal validation and verification rules explicitly. Do not label seeded scores as AI measurements. Record scoring model/version and measured evidence; unimplemented scoring must be marked unavailable.
- Support filtering/sorting/pagination and proximity queries. Return actual encoded geometry, distance, duration, safety evidence, verification status, confidence provenance, and measured savings against a comparable baseline.
- Booking must accept a verified route ID and enforce compatibility with endpoints/vehicle. Return the actual selected route and savings. Do not hardcode 12 minutes or allow unsafe/unverified geometry into navigation.

## Required verification and deliverables

- Run unit/integration tests with a test database. Cover authentication/role escalation, OTP leakage and attempt limits, simultaneous accept and create requests, idempotency payload conflicts, cancellation/payment races, active-ride recovery, signed/replayed webhooks, ledger consistency, route vote duplication, and unauthorized socket subscriptions/location writes.
- Provide the changed files, migration/rollback plan, exact test commands and results, remaining blockers, OpenAPI JSON, and FRONTEND_HANDOFF.md with concrete payload examples.
- List external provider credentials/configuration needed without printing secrets. State which services are implemented versus blocked by configuration. Do not claim production verification from mocked tests.
- Return the contract and implementation summary so the frontend AI can integrate and test against it. Do not rewrite the frontend in this backend task.
