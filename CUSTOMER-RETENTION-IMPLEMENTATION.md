# Customer Retention Implementation

## Scope

This document tracks the shipped implementation status of the customer-retention roadmap in ClalMobile.

Last updated: `2026-04-12`

## Status Summary

- [x] The original 8 roadmap phases are implemented in the current codebase.
- [x] Previously partial gaps were completed in the latest pass:
  - HOT search is now wired in both API and CRM UI.
  - CRM 360 now returns a unified timeline built from real system activity.
  - Customer account now surfaces `customer_code` and linked HOT accounts.
  - UPay success flow now carries and displays `customer_code`.
- [ ] Optional hardening items remain for future work, but they are not blockers for the current feature set.

## Phase Status

- [x] Phase 1 — Customer identity foundation in database
- [x] Phase 2 — Issue customer code on first order
- [x] Phase 3 — Returning customer OTP prefill in store
- [x] Phase 4 — CRM HOT account management
- [x] Phase 5 — Advanced search and 360 summary
- [x] Phase 6 — Timeline and audit enrichment
- [x] Phase 7 — Commission identity linking
- [x] Phase 8 — Sales docs integration

## Implemented

### Database (4 migrations)

- `20260411000001_customer_identity.sql` — adds `customers.customer_code` and creates `customer_hot_accounts`
- `20260411000002_commission_customer_link.sql` — adds customer linkage to `commission_sales`
- `20260411000003_sales_docs_customer_fk_and_commission_backfill.sql` — links sales docs to customers and backfills commission identity
- `20260412000001_commission_identity_enrichment.sql` — enriches commission identity with HOT linkage, snapshots, and match status

### Phase 1-2: Customer Identity Foundation

- `POST /api/orders` generates/assigns `customer_code` during order creation
- Customer auth/profile payloads expose `customer_code`
- `types/database.ts` includes `auth_token_expires_at` to match runtime usage
- Current `customer_code` generation is application-level via `generateCustomerCode()` and order assignment logic

### Phase 3: Store OTP Prefill + Account Identity

- Cart page (`app/store/cart/page.tsx`) supports returning-customer OTP flow and auto-prefill
- Customer profile API (`app/api/customer/profile/route.ts`) returns `{ customer, hotAccounts }`
- Store account page (`app/store/account/page.tsx`) displays:
  - customer profile data
  - `customer_code`
  - linked HOT accounts in read-only form
- Order confirmation and checkout success flows display `customer_code`
- UPay callback now forwards `customer_code` to the success page

### Phase 4: CRM HOT Account Management

- Full CRUD API: `app/api/crm/customers/[id]/hot-accounts/route.ts`
- Soft-delete (archive) pattern for HOT accounts
- Auto-unset other primaries when setting a new primary
- Audit logging on HOT account create/update/archive actions
- CRM customer detail page includes HOT account management UI

### Phase 5: Advanced Search + 360 View

- CRM customer search includes `customer_code`
- Dedicated `hot_search` param supports HOT identity lookup by:
  - `hot_mobile_id`
  - `hot_customer_code`
  - `line_phone`
- CRM list UI now sends `hot_search` to the backend
- 360 endpoint returns customer summary data with:
  - orders
  - deals
  - conversations
  - notes
  - HOT accounts
- Customer list shows `customer_code` inline

### Phase 6: Timeline / Audit Enrichment

- HOT account mutations log into `audit_log` with `entity_type: customer_hot_account`
- CRM 360 now builds and returns a unified `timeline` from:
  - orders
  - deals
  - conversations
  - notes
  - HOT accounts
  - customer audit entries
  - HOT account audit entries
- CRM customer detail page includes a dedicated timeline tab
- Timeline aggregation is covered by focused unit tests

### Phase 7: Commission Identity Linking

- `commission_sales.customer_id` links commissions to `customers(id)`
- Commission sync also stores:
  - `customer_hot_account_id`
  - `store_customer_code_snapshot`
  - `hot_mobile_id_snapshot`
  - `match_status`
- Auto-sync resolves identity from the order customer and the primary HOT account when available
- Identity indexes support efficient commission lookups and reporting

### Phase 8: Sales Docs Integration

- Customer lookup endpoint: `GET /api/pwa/customer-lookup?phone=...&code=...`
- Sales-doc creation auto-resolves `customer_id` from phone or linked order
- Sales-doc update supports `customer_phone` re-linking
- List and detail responses join customer identity fields
- UI surfaces customer name / phone / `customer_code` on sales-doc records

## Key Decisions

1. `customer_code` is a stable internal identifier at the customer level.
2. HOT identities live in a dedicated `customer_hot_accounts` table rather than on `customers`.
3. One customer can own multiple HOT accounts, with one primary account for downstream operational use.
4. Public checkout still identifies a customer by phone + OTP, while the stable store identity is persisted through `customer_code`.
5. Commission identity stores both relational links and snapshots so later profile changes do not erase operational history.
6. Timeline data is composed from multiple domains instead of relying on a single-purpose event table.

## Key Files Touched

### Database / Types

- `supabase/migrations/20260411000001_customer_identity.sql`
- `supabase/migrations/20260411000002_commission_customer_link.sql`
- `supabase/migrations/20260411000003_sales_docs_customer_fk_and_commission_backfill.sql`
- `supabase/migrations/20260412000001_commission_identity_enrichment.sql`
- `types/database.ts`

### Store / Customer

- `lib/validators.ts`
- `lib/customer-auth.ts`
- `app/api/orders/route.ts`
- `app/api/auth/customer/route.ts`
- `app/api/customer/profile/route.ts`
- `app/store/cart/page.tsx`
- `app/store/account/page.tsx`
- `app/store/checkout/success/page.tsx`
- `app/api/payment/upay/callback/route.ts`

### CRM

- `app/api/crm/customers/[id]/hot-accounts/route.ts`
- `app/api/crm/customers/[id]/360/route.ts`
- `app/api/crm/customers/route.ts`
- `app/crm/customers/[id]/page.tsx`
- `app/crm/customers/page.tsx`
- `lib/crm/customer-timeline.ts`

### Sales Docs / Commissions

- `app/api/pwa/customer-lookup/route.ts`
- `app/api/pwa/sales/route.ts`
- `app/api/pwa/sales/[id]/route.ts`
- `lib/commissions/sync-orders.ts`

### Tests

- `tests/unit/customer-retention.test.ts`
- `tests/unit/customer-timeline.test.ts`

## Verification

- `npm run build` passes
- Focused retention and timeline unit tests pass

## Related Docs

- Technical handoff: `CUSTOMER-RETENTION-TECHNICAL-HANDOFF.md`
- Staff and admin guide: `CUSTOMER-RETENTION-STAFF-ADMIN-GUIDE.md`

## Known Follow-ups (Optional Hardening)

1. Move `customer_code` generation to a DB sequence/trigger if a stronger database-level guarantee is required.
2. Add a dedicated admin-only phone correction workflow with explicit audit reason, instead of relying on direct edit behavior.
3. Automate HOT identity verification in the future if HOT Mobile exposes a reliable integration path.

## Notes for the Next Engineer

- The roadmap itself is complete; current follow-ups are hardening improvements, not missing core functionality.
- Do not remove the identity snapshots in commissions or sales docs; they are intentional and protect historical truth.
- Any future changes to customer identity should preserve:
  - stable `customer_code`
  - one-to-many HOT account support
  - commission/customer linkage
  - timeline/audit visibility
