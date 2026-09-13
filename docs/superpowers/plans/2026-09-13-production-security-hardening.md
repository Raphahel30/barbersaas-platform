# Production Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed production security and concurrency defects while preserving the public booking flow.

**Architecture:** Reuse the existing centralized auth guards before every service-role operation, extract pure validation helpers for testability, and enforce race-sensitive invariants in Postgres RPCs. One forward-only Supabase migration carries the database guarantees and explicit privileges.

**Tech Stack:** Next.js 15 Server Actions/Routes, TypeScript, Supabase/Postgres, Node test runner through `tsx`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-production-security-hardening-design.md`

## Global Constraints

- Do not expose service-role credentials or private profile fields.
- Tenant authorization must be derived from the authenticated profile.
- Public booking remains available to `active` and `trial` tenants only.
- Public tracking fails closed when a token hash is absent.
- No GitHub push without separate user confirmation.

---

### Task 1: Administrative authorization

**Files:**
- Modify: `app/actions/barber-admin.ts`
- Modify: `app/(barber-admin)/[tenantSlug]/admin/page.tsx`
- Test: `scripts/test-security-regressions.ts`

- [ ] Add a failing behavioral test for tenant/role authorization helpers.
- [ ] Reuse `requireTenantStaff` for operational reads/actions and `requireTenantOwner` for catalog/configuration mutations.
- [ ] Resolve slug to tenant, then authorize before fetching private data.
- [ ] Scope every mutation by the authorized tenant and verify affected rows.
- [ ] Remove fabricated production appointments, tabs, and products.

### Task 2: Safe onboarding identity ownership

**Files:**
- Modify: `app/actions/onboarding.ts`
- Modify: `app/actions/onboarding-wizard.ts`

- [ ] Add a failing regression test for pre-write duplicate-email rejection.
- [ ] Replace `listUsers` fallback with a generic duplicate-account failure.
- [ ] Ensure tenant/profile writes occur only after successful user creation.
- [ ] Keep cleanup of a newly created user when later onboarding writes fail.

### Task 3: Booking and tracking database guarantees

**Files:**
- Create: `supabase/migrations/<timestamp>_close_production_security_gaps.sql`
- Modify: `app/actions/booking.ts`
- Modify: `tests/e2e/booking-flow.spec.ts`

- [ ] Add regression coverage for missing tracking hashes and genuinely concurrent RPC calls.
- [ ] Make tracking validation fail closed for missing hashes.
- [ ] Serialize same-barber booking RPC calls with a transaction advisory lock.
- [ ] Permit `active` and `trial` tenants, remove the legacy tokenless overload, and revoke unintended function execution grants.

### Task 4: Monthly-club privacy and atomic consumption

**Files:**
- Modify: `app/actions/monthly-club.ts`
- Modify: migration from Task 3

- [ ] Define a minimal public subscriber result with no identity, billing, or subscription ID.
- [ ] Require staff authentication for cut consumption.
- [ ] Implement an atomic tenant-scoped consumption RPC and update the action to call it.

### Task 5: Payment and public API hardening

**Files:**
- Modify: `app/api/webhooks/gateways/[provider]/route.ts`
- Modify: `app/api/tenant/resolve/route.ts`
- Test: `scripts/test-security-regressions.ts`

- [ ] Extract and test normalized amount/currency validation for all providers.
- [ ] Verify conditional webhook update returned a row before side effects.
- [ ] Remove email and phone from the public professional projection.
- [ ] Reject suspended and cancelled public tenants consistently.

### Task 6: Verification and database rollout

**Files:**
- Modify: `package.json`
- Modify: `types/database.types.ts` if generated types require it

- [ ] Run focused regression tests and TypeScript/build checks.
- [ ] Review migration SQL and run `git diff --check`.
- [ ] Apply the migration to the linked Supabase project.
- [ ] Query function ACLs and behavioral invariants after rollout.
- [ ] Run Supabase security and performance Advisors.
- [ ] Report any environmental limitation honestly and leave GitHub unpushed.
