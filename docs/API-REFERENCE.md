# API Reference

> Every HTTP route in the ClalMobile app, grouped by module. Auth column uses
> shorthand: `admin`, `employee`, `customer`, `public`, `service`, `cron`.
>
> **Route count: ~147** (was 129 before the 2026-04-18 employee-portal expansion).

This document is generated from source. For conceptual descriptions see
[`DOCS.md`](../DOCS.md). For auth implementation details see
[`docs/SECURITY.md`](./SECURITY.md).

---

## Conventions

- All routes return JSON via `lib/api-response`:
  - Success: `{ success: true, data?, meta? }`
  - Error:   `{ success: false, error: string, details? }`
- Error HTTP semantics:
  - `400` validation / bad payload
  - `401` not authenticated
  - `403` authenticated but lacks permission
  - `404` entity not found
  - `409` conflict (double-submit, duplicate)
  - `423` locked (e.g. commission month locked)
  - `429` rate limited
  - `500` unexpected server error
  - `503` dependency unavailable (DB, missing env var)
- **CSRF:** required on all state-changing routes (`POST`/`PUT`/`PATCH`/`DELETE`),
  enforced by `middleware.ts`. Obtain a token from `GET /api/csrf` and send it
  back in the `x-csrf-token` header on subsequent writes.
- **Rate limits:** applied per IP, keyed in `lib/rate-limit.ts`. Default is
  `20 req/60s`; auth, payment, and chat endpoints are lower.
- **Auth shorthand:**
  - `admin` — Supabase session, `users.role in ('admin','manager','super_admin')`, checked via `requireAdmin` or `withAdminAuth`/`withPermission`
  - `employee` — PWA sales agent session, checked via `requireEmployee`
  - `customer` — customer session (cookie), checked via customer auth helper
  - `public` — no guard; rate-limited only
  - `service` — bearer token in `Authorization` header (`COMMISSION_API_TOKEN`, `CRON_SECRET`, or provider HMAC)
  - `cron` — `Authorization: Bearer $CRON_SECRET` only

---

## Table of Contents

1. [Admin routes](#admin-routes)
   - [Products & Categories](#products--categories)
   - [Orders & Sales Docs](#orders--sales-docs)
   - [Commissions](#commissions)
   - [Content & Site](#content--site)
   - [Settings, Integrations, Uploads](#settings-integrations-uploads)
   - [Analytics & AI](#analytics--ai)
2. [CRM routes](#crm-routes)
3. [Store & catalog routes](#store--catalog-routes)
4. [Auth routes](#auth-routes)
5. [Payment & webhook routes](#payment--webhook-routes)
6. [Push notification routes](#push-notification-routes)
7. [PWA (employee) routes](#pwa-employee-routes)
8. [Customer self-service routes](#customer-self-service-routes)
9. [Employee portal](#employee-portal)
10. [Cron routes](#cron-routes)
11. [Health & utility](#health--utility)
12. [Scheduled reports](#scheduled-reports)
13. [Example request / response bodies](#example-request--response-bodies)
14. [Security notes](#security-notes)

---

## Admin routes

All routes below live under `/api/admin/*`, require an authenticated admin
session, and are protected by CSRF on write verbs. Many return Arabic error
messages.

### Products & Categories

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/admin/products` | GET, POST, PUT, DELETE | admin | List / create / update / delete products (supports bulk `?ids=a,b,c`). |
| `/api/admin/products/autofill` | POST | admin | AI autofill product fields from model name. |
| `/api/admin/products/bulk-color-images` | POST | admin | Upload multiple per-color images in one call. |
| `/api/admin/products/color-image` | POST | admin | Upload one color-variant image. |
| `/api/admin/products/distribute-stock` | POST | admin | Distribute aggregate stock across variants. |
| `/api/admin/products/export` | GET | admin | Export products as CSV/JSON. |
| `/api/admin/products/import-image` | POST | admin | Fetch an image by URL and attach to product. |
| `/api/admin/products/pexels` | POST | admin | Search Pexels for product imagery. |
| `/api/admin/categories` | GET, POST, PUT, DELETE | admin | CRUD for categories. |
| `/api/admin/lines` | GET, POST, PUT, DELETE | admin | CRUD for HOT Mobile line plans. |
| `/api/admin/prices/apply` | POST | admin | Apply queued price changes to products. |
| `/api/admin/prices/match` | POST | admin | Heuristic price matching. |
| `/api/admin/prices/match-direct` | POST | admin | Directly match a price to a target product. |

### Orders & Sales Docs

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/admin/order` | GET, PUT | admin (permission) | Legacy single-order read / update. |
| `/api/admin/orders/create` | POST | admin (permission) | Create an order on behalf of a customer. |
| `/api/admin/orders/[id]/history` | GET | admin (permission) | Audit trail for a given order. |
| `/api/admin/sales-docs` | GET | admin (`commissions:manage`) | List sales documents (filter by status, employee, date). |
| `/api/admin/sales-docs/[id]/detail` | GET | admin (`commissions:manage`) | Full sales doc with items, attachments, events. |
| `/api/admin/sales-docs/[id]/verify` | POST | admin (`commissions:manage`) | Mark a submitted doc as verified (legacy two-step flow). |
| `/api/admin/sales-docs/[id]/reject` | POST | admin (`commissions:manage`) | Reject a submitted doc with reason. |
| `/api/admin/sales-docs/[id]/cancel` | POST | admin (`commissions:manage`) | Cancel a synced sale + its commission. |

### Commissions

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/admin/commissions/dashboard` | GET | admin or service (Bearer) | Monthly dashboard with pace tracking. |
| `/api/admin/commissions/summary` | GET | admin or service (Bearer) | Lightweight summary (external HTML app). |
| `/api/admin/commissions/analytics` | GET | admin | Multi-month analytics + trend lines. |
| `/api/admin/commissions/sales` | GET, POST, PUT, DELETE | admin or service | CRUD sales entries. |
| `/api/admin/commissions/targets` | GET, POST, PATCH | admin | Monthly employee targets. |
| `/api/admin/commissions/sanctions` | GET, POST, DELETE | admin | Sanctions (deductions). |
| `/api/admin/commissions/profiles` | GET, POST, DELETE | admin | Per-employee commission profiles (rates, caps). |
| `/api/admin/commissions/employees` | GET, POST, PATCH, DELETE | admin | Manage employees inside commissions module. |
| `/api/admin/commissions/employees/list` | GET | service (Bearer) | Read-only employee list for external apps. |
| `/api/admin/corrections` | GET | admin (`commissions:manage`) | Cross-employee list of correction requests (filter by status). |
| `/api/admin/corrections/[id]` | PUT | admin (`commissions:manage`) | Respond to a pending request. Transitions `pending → {approved, rejected, resolved}`, adds an `employee_activity_log` row, emits `audit_log`. Already-resolved returns `409`. |
| `/api/admin/announcements` | GET, POST | admin (POST: `settings:manage`) | List all broadcasts with readCount/totalRecipients, or publish a new one (priority + target + optional expiry). |
| `/api/admin/commissions/bridge` | GET | admin | Bridge data (orders ↔ commissions). |
| `/api/admin/commissions/calculate` | POST | admin | Recompute commission amounts for a period. |
| `/api/admin/commissions/sync` | GET, POST | admin | Sync orders into `commission_sales`. |
| `/api/admin/commissions/export` | GET | admin | Export CSV for a given period. |

### Content & Site

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/admin/heroes` | GET, POST, PUT, DELETE | admin | Homepage hero carousel entries. |
| `/api/admin/website` | GET, PUT | admin | Global website content blocks. |
| `/api/admin/sub-pages` | GET, POST, PUT, DELETE | admin | Secondary static pages. |
| `/api/admin/coupons` | GET, POST, PUT, DELETE | admin | Discount coupon codes. |
| `/api/admin/deals` | GET, POST, PUT, DELETE | admin | Promotional deals. |
| `/api/admin/reviews/generate` | POST | admin | AI-assisted review generation (seed content). |

### Settings, Integrations, Uploads

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/admin/settings` | GET, PUT | admin | System settings key/value store. |
| `/api/admin/integrations/test` | POST | admin | Smoke-test an integration (WhatsApp, email, SMS). |
| `/api/admin/upload` | POST | admin | Generic file upload → Supabase Storage. |
| `/api/admin/upload-logo` | POST, DELETE | admin | Upload / remove site logo. |
| `/api/admin/supabase-management` | GET, POST | admin (super_admin only) | Privileged Supabase ops (branch mgmt). |
| `/api/admin/whatsapp-templates` | GET, POST, DELETE | admin | WhatsApp message templates. |
| `/api/admin/whatsapp-test` | POST | admin | Dry-run a template to a single recipient. |
| `/api/admin/contact-notify` | POST | admin | Notify admins about a new contact form entry. |

### Analytics & AI

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/admin/analytics` | GET | admin | Site analytics aggregates. |
| `/api/admin/analytics/dashboard` | GET | admin | Dashboard widgets (sales, visits, funnel). |
| `/api/admin/features/stats` | GET | admin | Feature adoption stats. |
| `/api/admin/ai-enhance` | POST | admin | AI text enhancement. |
| `/api/admin/image-enhance` | POST | admin | AI image enhancement (upscale / bg-remove). |
| `/api/admin/ai-usage` | GET | admin | Read AI token usage / cost. |

---

## CRM routes

All routes below live under `/api/crm/*` and require an authenticated admin
session (CRM shares the admin role model; row-level filtering scopes per-user
visibility).

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/crm/dashboard` | GET | admin | Overview widgets (conversations, tasks, pipeline). |
| `/api/crm/customers` | GET | admin | List CRM customers. |
| `/api/crm/customers/[id]` | GET, PUT | admin | Customer detail + edit. |
| `/api/crm/customers/[id]/360` | GET | admin | 360° customer view (orders + notes + chats). |
| `/api/crm/customers/[id]/notes` | GET, POST | admin | Customer-scoped notes. |
| `/api/crm/customers/[id]/hot-accounts` | GET | admin | Hot-account flagging / scoring. |
| `/api/crm/customers/export` | GET | admin | CSV export of customers. |
| `/api/crm/customers/reconcile` | POST | admin | Reconcile duplicate customer records. |
| `/api/crm/chats` | GET | admin | Chat threads list. |
| `/api/crm/chats/[id]/messages` | GET, PUT | admin | Thread messages + mark-read. |
| `/api/crm/inbox` | GET, POST | admin | Multi-channel inbox conversations. |
| `/api/crm/inbox/[id]` | GET | admin | Single conversation with history. |
| `/api/crm/inbox/[id]/send` | POST | admin | Send outgoing message. |
| `/api/crm/inbox/[id]/status` | PUT | admin | Change conversation status. |
| `/api/crm/inbox/[id]/assign` | PUT | admin | Assign to a team member. |
| `/api/crm/inbox/[id]/notes` | GET, POST | admin | Conversation-scoped internal notes. |
| `/api/crm/inbox/[id]/summary` | POST | admin | AI summary of a thread. |
| `/api/crm/inbox/[id]/sentiment` | POST | admin | AI sentiment classification. |
| `/api/crm/inbox/[id]/suggest` | POST | admin | AI-suggested reply. |
| `/api/crm/inbox/[id]/recommend` | POST | admin | AI product recommendation. |
| `/api/crm/inbox/[id]/auto-label` | POST | admin | Auto-classify with label AI. |
| `/api/crm/inbox/labels` | GET, POST, PUT, DELETE | admin | Label taxonomy CRUD. |
| `/api/crm/inbox/templates` | GET, POST, PUT, DELETE | admin | Quick-reply templates. |
| `/api/crm/inbox/stats` | GET | admin | Inbox performance metrics. |
| `/api/crm/inbox/upload` | POST | admin | Attach a file to a conversation. |
| `/api/crm/orders` | GET | admin | Orders from CRM perspective. |
| `/api/crm/pipeline` | GET | admin | Sales pipeline data. |
| `/api/crm/pipeline/[id]/convert` | POST | admin | Convert a pipeline deal → order. |
| `/api/crm/tasks` | GET, POST, PUT, DELETE | admin | Task CRUD. |
| `/api/crm/users` | GET, POST, PUT, DELETE | admin | Team user management (super_admin only for writes). |
| `/api/crm/reports` | GET | admin | CRM reports module. |

---

## Store & catalog routes

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/orders` | POST | public | Customer checkout — creates order + customer. |
| `/api/store/autocomplete` | GET | public | Product search autocomplete. |
| `/api/store/smart-search` | GET | public | AI-assisted search (semantic). |
| `/api/store/order-status` | GET | public | Lookup order by phone + code. |
| `/api/cart/abandoned` | POST, DELETE | public | Persist / delete an abandoned-cart record. |
| `/api/reviews` | GET, POST, PUT, DELETE | public (GET) / customer (write) | Product reviews. |
| `/api/reviews/featured` | GET | public | Hand-picked featured reviews. |
| `/api/coupons/validate` | POST | public | Validate a coupon for the current cart. |

---

## Auth routes

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/auth/customer` | POST | public | Customer login / registration (phone + OTP via WhatsApp). |
| `/api/auth/change-password` | POST | admin or customer session | Change password for the current session user. |
| `/api/auth/forgot-password` | POST | public (rate-limited) | Send a password-reset email link to the submitted address. Responds 200 regardless of whether the address exists (no account enumeration). Powered by Supabase Auth's reset flow after the `@supabase/ssr` 0.7 upgrade that supports the new publishable key format. |
| `/api/auth/reset-password` | POST | public (token-gated) | Complete the reset — accepts the `code` from the Supabase email link + a new password. Validates password strength + rotates the session cookie. |
| `/api/csrf` | GET | public | Issue a CSRF token (cookie + body). |

> ClalMobile does not expose a dedicated `/api/otp/*` namespace. OTP flows are
> bundled inside `/api/auth/customer` (send / verify) and CRM/admin users use
> Supabase session auth directly.

---

## Payment & webhook routes

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/payment` | POST | public (rate-limited) | Initiate a payment session (provider-agnostic). |
| `/api/payment/callback` | POST, GET | service (provider HMAC) | Generic payment provider callback. |
| `/api/payment/upay/callback` | GET | service (signed query) | uPay-specific redirect callback. |
| `/api/webhook/whatsapp` | GET, POST | service (verify token / HMAC) | WhatsApp (yCloud) inbound webhook. |
| `/api/webhook/twilio` | GET, POST | service (Twilio auth header) | Twilio SMS inbound webhook. |

> All webhook routes verify the provider signature before reading the body.
> `GET` variants of webhooks exist only to satisfy provider verification
> challenges — they do not expose data.

---

## Push notification routes

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/push/vapid` | GET | public | VAPID public key (for browser subscription). |
| `/api/push/subscribe` | POST, DELETE | public (rate-limited) | Subscribe / unsubscribe a push endpoint. |
| `/api/push/send` | GET, POST | admin | Broadcast or targeted push. |

---

## PWA (employee) routes

Used by the installable sales-agent PWA. All require `requireEmployee`
(bearer token issued at employee sign-in).

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/pwa/customer-lookup` | GET | employee | Lookup a customer by phone / id. |
| `/api/pwa/customers` | POST | employee | Quick-create a customer from the field with phone-dedup — returns the existing row on match instead of creating a duplicate. |
| `/api/pwa/sales` | GET, POST | employee | List my sales docs / create a new draft. |
| `/api/pwa/sales/[id]` | GET, PUT | employee | Read / edit one of my drafts. |
| `/api/pwa/sales/[id]/attachments` | POST | employee | Record attachment metadata. |
| `/api/pwa/sales/[id]/attachments/sign` | POST | employee | Mint a short-lived Signed Upload URL into the private `sales-docs-private` Supabase Storage bucket. The client uploads the file directly to Supabase, then calls `POST /api/pwa/sales/[id]/attachments` to register metadata. Service-role key never reaches the browser. |
| `/api/pwa/sales/[id]/submit` | POST | employee | Submit a draft → commission_sales (atomic). |

---

## Customer self-service routes

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/customer/profile` | GET, PUT | customer | Read / update own profile. |
| `/api/customer/orders` | GET | customer | Order history for the signed-in customer. |
| `/api/customer/loyalty` | GET, POST | customer | Loyalty points balance + redeem. |

---

## Employee portal

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/employee/me` | GET | employee | Authenticated profile (id, name, email, contract-defined rate snapshot, locale preference). Acts as the session bootstrap call for the unified Sales PWA. |
| `/api/employee/commissions` | GET | employee | Own commission dashboard (month scoped). |
| `/api/employee/commissions/dashboard` | GET | employee | Merged today + month + milestones + pacing colour (used by the PWA home). |
| `/api/employee/commissions/calculate` | POST | employee | Pure commission preview — returns `{ contractCommission, employeeCommission, ownerProfit }` for a hypothetical sale. No ledger writes. |
| `/api/employee/commissions/chart` | GET | employee | Last N months (`?range=12months`, clamped to [1, 24]) of sales, commissions, and targets. |
| `/api/employee/commissions/details` | GET | employee | Per-sale breakdown with rate snapshot, milestones touched, and sanctions (`?month=YYYY-MM`). |
| `/api/employee/commissions/export` | GET | employee | Bilingual PDF export of a given month (`?month=YYYY-MM`). Uses `pdf-lib` + `@pdf-lib/fontkit` with the bundled Cairo font for Arabic/Hebrew glyph rendering. Falls back to Helvetica (Latin-only) if the font asset can't be loaded. See [`I18N.md` — PDF export](./I18N.md#pdf-export--bilingual-handling). |
| `/api/employee/corrections` | GET, POST | employee | List own dispute requests / submit a new one. Submission also writes to `employee_activity_log`. |
| `/api/employee/announcements` | GET | employee | Active broadcasts (target ∈ {`all`,`employees`}, not expired) with per-user `read` flag + `unreadCount`. |
| `/api/employee/announcements/[id]/read` | POST | employee | Idempotent upsert into `admin_announcement_reads`. |
| `/api/employee/activity` | GET | employee | Paginated personal audit trail (`?limit=50&offset=0`) — every sale, sanction, target change, correction resolution. |

---

## Cron routes

All cron routes require `Authorization: Bearer $CRON_SECRET`. They also accept
`GET` for manual testing by an operator curling with the same token.

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/cron/reports` | POST, GET | cron | Send daily / weekly admin report link via WhatsApp. |
| `/api/cron/backup` | POST | cron | Snapshot DB to storage bucket. |
| `/api/cron/cleanup` | POST | cron | Garbage-collect expired rows (rate-limit keys, OTPs, abandoned carts). |

---

## Health & utility

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | public | Liveness + DB check. Used by uptime monitors. |
| `/api/csrf` | GET | public | Issue a CSRF token. |
| `/api/chat` | POST | public (rate-limited) | WebChat message endpoint (bot). |
| `/api/contact` | POST | public (rate-limited) | Public contact form. |
| `/api/reviews` | GET / POST | public / customer | Product reviews (see Store section). |
| `/api/reviews/featured` | GET | public | Curated reviews. |
| `/api/settings/public` | GET | public | Public settings subset (site title, hours, etc.). |
| `/api/notifications` | GET, POST, PATCH | admin | In-app notifications feed. |
| `/api/email` | POST | service (internal) | Internal send-email endpoint (called by server code only). |

---

## Scheduled reports

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/reports/daily` | GET | admin | Render today's report (HTML/JSON). |
| `/api/reports/weekly` | GET | admin | Render this week's report. |

These routes are typically opened via a signed link sent from
`/api/cron/reports`; the admin cookie supplies the auth.

---

## Example request / response bodies

> All examples use **sanitized placeholders**. Never copy a UUID, phone, or
> email literal from this document into a real request — they are not valid.

### 1. `POST /api/orders` — customer checkout

```http
POST /api/orders
Content-Type: application/json
x-csrf-token: <token-from-/api/csrf>

{
  "customer": {
    "name": "Example Customer",
    "phone": "+9725XXXXXXXX",
    "city": "Tel Aviv",
    "address": "1 Example St.",
    "email": "user@example.com",
    "idNumber": "000000000"
  },
  "items": [
    {
      "productId": "00000000-0000-0000-0000-000000000000",
      "name": "iPhone 16 Pro",
      "brand": "Apple",
      "type": "device",
      "price": 4999,
      "quantity": 1,
      "color": "Black",
      "storage": "256GB"
    }
  ],
  "couponCode": "EXAMPLE10",
  "discountAmount": 100,
  "source": "web"
}
```

Successful response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "orderId": "ORD-000000",
    "customerCode": "CUST-000000",
    "total": 4899,
    "currency": "ILS",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Common errors: `400` validation (invalid phone / id / empty cart),
`429` too many attempts from the same IP.

---

### 2. `POST /api/admin/sales-docs/[id]/cancel` — manager cancel flow

```http
POST /api/admin/sales-docs/123/cancel
Cookie: sb-access-token=<admin-session>
Content-Type: application/json
x-csrf-token: <token>

{
  "reason": "Customer returned the device within 14 days."
}
```

Successful response:

```json
{
  "success": true,
  "data": {
    "doc": {
      "id": 123,
      "status": "cancelled",
      "cancelled_at": "2026-01-01T10:00:00.000Z",
      "cancellation_reason": "Customer returned the device within 14 days."
    },
    "cancelled_commission_ids": [456, 457],
    "affected_months": ["2025-12"]
  }
}
```

Failure cases:
- `403 Forbidden` if the signed-in admin lacks `commissions:manage`.
- `409 Conflict` if another admin already cancelled it.
- `423 Locked` if the month is locked (`check_month_lock` trigger).

---

### 3. `POST /api/pwa/sales/[id]/submit` — direct commission register

```http
POST /api/pwa/sales/42/submit
Authorization: Bearer <employee-pwa-token>
Content-Type: application/json
x-csrf-token: <token>

{}
```

Successful response:

```json
{
  "success": true,
  "data": {
    "doc": {
      "id": 42,
      "status": "synced_to_commissions",
      "submitted_at": "2026-01-01T10:00:00.000Z",
      "synced_at":    "2026-01-01T10:00:00.000Z"
    },
    "commissions": [
      {
        "id": 9001,
        "saleType": "line",
        "employeeCommission": 120,
        "companyCommission":  80
      }
    ]
  }
}
```

Failure cases:
- `400` missing required attachments for the sale type.
- `403` the doc does not belong to the signed-in employee.
- `409` already submitted (atomic transition guard).
- `500` commission registration failed — the doc is rolled back to `rejected`
  with the failure reason in `rejection_reason`.

---

### 4. `GET /api/employee/commissions?month=YYYY-MM` — employee portal

```http
GET /api/employee/commissions?month=2026-01
Authorization: Bearer <employee-pwa-token>
```

Successful response (truncated):

```json
{
  "success": true,
  "data": {
    "month": "2026-01",
    "employee": {
      "id":    "00000000-0000-0000-0000-000000000000",
      "name":  "Example Employee",
      "email": "employee@example.com"
    },
    "summary": {
      "totalLines":   12,
      "totalDevices":  8,
      "grossAmount": 5400,
      "sanctions":    150,
      "netAmount":   5250,
      "targetPct":    87
    },
    "sales":         [ /* … */ ],
    "sanctions":     [ /* … */ ],
    "sales_docs":    [ /* … */ ],
    "target": {
      "target_total":          6000,
      "target_lines_count":      15,
      "target_devices_count":    10
    }
  }
}
```

`month` defaults to the current month in `Asia/Jerusalem`. Data is always
filtered to the signed-in employee — query-string tampering cannot reveal
another user's figures.

---

### 5. `GET /api/health` — liveness

```http
GET /api/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "db":     "reachable",
    "time":   "2026-01-01T00:00:00.000Z",
    "version": "1.x.x"
  }
}
```

---

## Security notes

See [`docs/SECURITY.md`](./SECURITY.md) for the full model. Summary:

- **Rate limits** (`lib/rate-limit.ts`): default **20 req / 60 s per IP**;
  `/api/auth/*`, `/api/payment*`, `/api/chat`, `/api/contact` and
  `/api/orders` are lower. Exceeding returns `429`.
- **CSRF**: double-submit cookie + header, enforced in `middleware.ts` for all
  non-`GET` routes. Tokens come from `GET /api/csrf`.
- **Service-role usage**: `SUPABASE_SERVICE_ROLE_KEY` is read only inside API
  routes via `createAdminSupabase()` — it is never bundled into client code.
- **RLS**: Row-Level Security is `ENABLE`d on all application tables. Admin
  routes use the service-role client intentionally (behind `requireAdmin`);
  customer-facing routes rely on RLS via the session client. See
  [migrations/...-rls-hardening.sql](../supabase/migrations/) and
  [`tests/rls-contract`](../tests/) for the contract.
- **Bearer endpoints**: a limited set of commission endpoints accept
  `Authorization: Bearer $COMMISSION_API_TOKEN` for an external HTML app.
  These are read-mostly and scoped; rotate the token in `.env` to revoke.
- **Cron endpoints**: authenticated by `CRON_SECRET` bearer only. Never log
  this token. Missing env var returns `503` (not `401`) to make
  misconfiguration obvious in staging.
- **Webhooks**: signature / HMAC verified before parsing. Replay protection
  is provider-specific — see `lib/webhook-verify.ts`.

---

*Last generated from source: see the top-level `app/api/**/route.ts` tree.
To keep this document in sync after adding a route, update the matching table
and (if public-facing) add a sanitized example.*
