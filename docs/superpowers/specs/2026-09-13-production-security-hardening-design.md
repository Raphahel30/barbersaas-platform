# Production Security Hardening Design

## Goal

Remove the confirmed authorization, tenant-isolation, booking-concurrency, payment-tracking, and webhook weaknesses without changing the intended public booking experience.

## Scope and order

1. Protect every `barber-admin` operation with server-side identity, role, and tenant-membership checks.
2. Make onboarding fail safely when an email already belongs to an account; no tenant or profile is written before identity ownership is proven.
3. Protect monthly-club reads and cut consumption, returning only public-safe data and moving consumption into a guarded atomic operation.
4. Add a Supabase migration that serializes overlapping booking attempts, accepts operational trial tenants, rejects tokenless public tracking, restricts privileged-function grants, and adds supporting indexes where required.
5. Make payment webhooks transition state exactly once and validate amount/currency from authoritative provider responses.
6. Remove professional email and phone from the public tenant resolver and replace process-local rate limiting with a shared database-backed limiter for sensitive public calls.

## Authorization model

- Administrative Server Actions authenticate with Supabase `getUser()` on the server.
- Tenant membership is derived from the authenticated profile, never accepted from browser input.
- `owner`, `admin`, and `barber` may read the operational panel. Destructive configuration and catalog operations are restricted to `owner` and `admin`; appointment workflow operations may include `barber`.
- Super-admin access remains explicit and audited.
- Service-role access is used only after application authorization succeeds.

## Booking and tracking model

- The canonical booking RPC remains the sole write path for public reservations.
- A transaction-scoped advisory lock serializes bookings for the same tenant and barber while the existing overlap query runs. This avoids extension/operator compatibility risks of an exclusion constraint while covering the RPC write path.
- Tenant statuses `active` and `trial` can accept reservations; suspended and cancelled tenants cannot.
- Public tracking is fail-closed: a missing stored hash never authorizes a request. Existing tokenless appointments remain accessible only through authenticated staff flows.
- The legacy RPC overload is removed after all application callers use the canonical tracking-token signature.

## Monthly club

- The public lookup returns only eligibility, remaining cuts, and a display-safe plan label; it never returns subscription IDs, phone, price, or billing dates.
- Staff-only consumption validates tenant membership and delegates decrementing to a transactional database function that refuses zero balance and inactive subscriptions.

## Payments and webhooks

- A webhook may produce side effects only when its conditional database transition returns an updated appointment.
- Every provider adapter normalizes confirmed amount and currency. Confirmation fails when these differ from the reservation fee and expected currency.
- Provider event deduplication remains, with the appointment transition acting as the second idempotency boundary.

## Public data and rate limiting

- Public tenant resolution exposes only fields required to render booking choices.
- Sensitive unauthenticated actions use a shared Postgres rate-limit function keyed by a one-way hash of operation, tenant, and requester identifier. Raw IP addresses and phone numbers are not stored.
- In-memory limiting may remain only as a non-security optimization.

## Migration safety

- Schema changes are additive where possible and recorded in one timestamped migration created with the Supabase CLI.
- Function privileges explicitly revoke `PUBLIC`, `anon`, and `authenticated` except for the deliberately public, sanitized tenant resolver.
- The migration is applied only after local tests and build succeed. Remote verification checks function ACLs, RPC behavior, constraints/indexes, and Advisors.

## Testing

- Unit tests cover authorization decisions, fail-closed tracking, sanitized public payloads, webhook transition handling, and payment amount validation.
- Booking integration tests issue genuinely concurrent RPC calls and assert that exactly one succeeds.
- Monthly subscription tests cover unauthorized access, tenant mismatch, zero balance, and concurrent consumption.
- Final verification runs targeted tests, the critical-flow suite under Node 20, the production build, migration inspection, and Supabase security/performance Advisors.

## Non-goals

- UI redesign, new payment providers, and unrelated mock/demo cleanup are excluded.
- Existing tenant data is not deleted or reassigned.
- No GitHub push is performed without separate user confirmation.
