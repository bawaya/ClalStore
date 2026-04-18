# Sales PWA

Public reference for the **unified ClalMobile Sales PWA** — the one app
every non-admin employee uses. As of 2026-04-18, the legacy standalone
`/employee/commissions` screen is gone (it 308-redirects here) and
`/sales-pwa` now hosts everything a field agent, CRM agent, or any other
non-admin employee needs: sales documentation, live commission view,
calculator, correction requests, activity timeline, and broadcast
announcements.

Route: `/sales-pwa`.
Source: [`app/sales-pwa/`](../app/sales-pwa/),
[`app/api/pwa/`](../app/api/pwa/),
[`app/api/employee/`](../app/api/employee/),
[`lib/pwa/`](../lib/pwa/).

---

## 1. Overview

The Sales PWA is a progressive web app (installable to the home screen,
mobile-first UI, service worker for offline support) that is **one app
for everything a non-admin employee does**:

- **Document sales** — create and submit. Submission registers the
  commission immediately.
- **View commissions** — daily dashboard, month detail, 12-month chart,
  PDF export.
- **Preview commissions** — what-if calculator that doesn't touch the
  ledger.
- **Dispute commissions** — typed correction requests.
- **Audit history** — personal activity timeline.
- **Receive announcements** — priority-coloured broadcast messages.

It's a thin client over the same Supabase backend the rest of the app
uses — no separate identity, no separate DB. PWA-specific additions:

- A service worker scoped to `/sales-pwa/` for offline shell caching +
  API-GET network-first caching + a POST replay queue (see §8).
- A manifest so it installs cleanly to the home screen.
- `/api/pwa/*` for sales documentation + customer creation.
- `/api/employee/*` for commissions, corrections, activity, and
  announcements.

### Who uses it

Every non-admin employee — field agents closing in person, CRM agents
tracking their deals, and any employee who needs to see their own
commission picture. Mobile-first, but fully usable on desktop (with a
left sidebar at ≥ 768 px; bottom tab nav below that).

---

## 1a. Page map

| Route | Purpose |
|---|---|
| `/sales-pwa` | Daily dashboard — today's sales, month target progress, recent sales, unread announcements peek, last activities. |
| `/sales-pwa/new` | Create a new sale (draft → submit). |
| `/sales-pwa/docs/[id]` | Sale detail — items, events, status. |
| `/sales-pwa/commissions` | Month picker + detailed breakdown + milestones + 12-month chart + PDF export. |
| `/sales-pwa/calculator` | Live commission calculator (what-if, no ledger writes). |
| `/sales-pwa/corrections` | Submit + track correction requests. |
| `/sales-pwa/activity` | Infinite-scroll personal timeline. |
| `/sales-pwa/announcements` | Broadcast messages from admin, with per-user read state. |

### Navigation

- **Mobile (< 768 px)** — bottom tab bar with 5 icons (home · new sale ·
  commissions · calculator · activity). Secondary items (corrections,
  announcements, docs) live in a slide-out drawer behind a menu icon.
- **Desktop (≥ 768 px)** — left sidebar (reversed for RTL, so it renders
  on the right) with the full nav list.
- **Unread bell badge** — the announcements icon shows a red dot + count
  fed by `/api/employee/announcements` (returns `unreadCount`).
- **Employee identity** — the shell calls `GET /api/employee/me` on mount
  and renders `{ name | fallback to email }` in the header.
  Response shape: `{ id, name, email, role, phone, avatarUrl }`.

### Legacy redirect

`/employee/commissions` is a server-side **308** redirect to
`/sales-pwa/commissions`. Old emails, push notifications, and bookmarks
keep working unchanged. Middleware doesn't gate `/employee/*` — the
redirect short-circuits before any auth wall.

Source: [`components/pwa/SalesPwaShell.tsx`](../components/pwa/SalesPwaShell.tsx),
[`app/api/employee/me/route.ts`](../app/api/employee/me/route.ts),
[`app/api/employee/announcements/route.ts`](../app/api/employee/announcements/route.ts).

---

## 1b. Daily dashboard

`/sales-pwa` is the home screen. It renders:

- **Today's KPIs** — sales count + total amount + commission for the
  current Asia/Jerusalem day.
- **Month target progress** — percentage of target reached, coloured by
  pacing:
  - **green** — on-track or ahead.
  - **yellow** — behind but still recoverable.
  - **red** — significantly behind, needs attention.

  Pacing is computed from working days (Sun–Thu, excluding Fri/Sat) and
  the required-per-day-remaining number is shown next to the target bar.
- **Milestones hit this month** — a trophy row counting how many
  contract-wide milestones have been crossed and the bonus earned
  attributed to this employee. See `docs/COMMISSIONS.md` §3 for the
  contract-wide milestone model.
- **Last 5 sales** — most recent rows with a source badge (Pipeline /
  PWA / Manual / auto_sync).
- **Unread announcements peek** — a small card with the 1–2 most recent
  unread announcements and a link to the full list.
- **Last 3 activities** — a condensed activity timeline card.

Data comes from `GET /api/employee/dashboard` (server-computed, single
round-trip). Chart data on the commissions page uses
`GET /api/employee/chart`.

---

## 2. Authentication

Same Supabase login as the rest of ClalMobile. There is no separate PWA
sign-in.

### Flow

1. Agent opens `/sales-pwa`. If not logged in, Supabase SSR cookies
   resolve to `null` and the API rejects with 401 (the UI then prompts
   for login via the main `/login` page).
2. All `/api/pwa/*` endpoints use `requireEmployee(req)` which:
   - Resolves the Supabase auth user via cookies.
   - Looks up the matching row in `public.users` by `auth_id`.
   - Rejects if `role === 'customer'` or `status ∈ {inactive, suspended}`.
   - Returns `{ appUserId, name, email, role }`.
3. `appUserId` is the canonical **app-user id** (not the Supabase auth
   id). It's used as `employee_key` / `employee_user_id` on every
   `sales_docs` row.

CSRF: every client request carries `csrfHeaders()` (see `lib/csrf-client.ts`).

Source: [`lib/pwa/auth.ts`](../lib/pwa/auth.ts).

---

## 3. End-to-end flow

```mermaid
flowchart TD
    A[Agent: /sales-pwa/new] -->|POST /api/pwa/sales| B[(sales_docs<br/>status = draft)]
    A -->|optional| C[POST /api/pwa/customers]
    C --> CU[(customers)]

    B --> D[Open doc detail page]

    D -->|POST /api/pwa/sales/&#91;id&#93;/submit| S[Atomic UPDATE<br/>status → synced_to_commissions<br/>WHERE status IN draft,rejected]
    S -->|0 rows| Y[409 — already submitted]
    S -->|1 row| R[registerSaleCommission<br/>source = sales_doc]
    R --> CS[(commission_sales)]
    R -->|on error| Z[rollback status → rejected]
```

The agent-facing steps:

1. **Create draft** at `/sales-pwa/new` → `POST /api/pwa/sales`.
2. **(Optional) Register customer** if phone lookup returns nothing →
   `POST /api/pwa/customers`.
3. **Submit** → `POST /api/pwa/sales/[id]/submit`. On success the sale is
   already in `commission_sales`. No manager approval queue.

---

## 4. API routes

All routes are rooted at `/api/pwa/*`. All require `requireEmployee`
auth. All operate on the authenticated employee's own data
(`employee_key = authed.appUserId`).

### `GET /api/pwa/sales`

List the authed employee's docs, newest first (limit 200).

Query: `status`, `date_from`, `date_to`, `search` (matches `notes`,
`order_id`, customer name/phone/code). Returns `{ docs }` with each doc
joined to its `customer` summary (id / name / phone / code).

### `POST /api/pwa/sales`

Create a draft doc.

Required body: `sale_type ∈ {line, device, mixed}`, `total_amount > 0`.
Optional: `sale_date` (YYYY-MM-DD, within the last 90 days),
`customer_id`, `customer_phone`, `order_id`, `notes`, `items[]`,
`doc_uuid` (stable client UUID for offline), `idempotency_key`.

**Customer auto-resolution:**

- If `customer_id` not supplied but `customer_phone` is → phone lookup
  via normalised candidates.
- Else if `order_id` is → fetch the order's `customer_id`.

Creates `sales_docs` row + `sales_doc_items` rows (if supplied) +
`sales_doc_events(event_type='created')`.

Idempotency: partial unique index on `(employee_key, idempotency_key)`
prevents accidental double-inserts from retries.

### `GET /api/pwa/sales/[id]`

Fetch a single doc (must belong to the authed employee) with its items
and event trail.

### `PUT /api/pwa/sales/[id]`

Update a doc **only while it's in `draft` or `rejected` state**. Rejects
updates to submitted/verified/cancelled/synced docs with 400.

### `POST /api/pwa/sales/[id]/submit`

See §5 — submit flow.

### `POST /api/pwa/customers`

Create a new customer from the PWA. Deduplicates:

- By normalised phone (handles `+9725XXXXXXXX`, `9725XXXXXXXX`,
  `05XXXXXXXX` variants — see `buildCustomerPhoneCandidates`).
- By `national_id` if supplied.

If a match is found, returns the existing customer with `existed: true`
(no insert). Otherwise inserts with `source: 'pwa'`.

### `GET /api/pwa/customer-lookup?phone=<phone>&code=<code>`

Quick client-side lookup for the draft form — returns a single customer
match (id / name / phone / customer_code) or `null`.

---

## 5. Submit flow

`POST /api/pwa/sales/[id]/submit` is the linchpin. Sequence:

1. **Auth** — `requireEmployee`. Doc must belong to the authed employee.
2. **State check** — doc status must be `draft` or `rejected`. Anything
   else → 409 "هذه الوثيقة تم إرسالها مسبقاً".
3. **Amount check** — `total_amount > 0`.
4. **Atomic transition:**

    ```sql
    UPDATE sales_docs
       SET status = 'synced_to_commissions',
           submitted_at = NOW(), synced_at = NOW(),
           rejection_reason = NULL, rejected_at = NULL
     WHERE id = <id>
       AND status IN ('draft','rejected')
       AND deleted_at IS NULL
    RETURNING *;
    ```

   A concurrent second submit sees zero rows returned → 409. This is the
   fix for audit issue 4.2.

5. **Register commission(s)** — one call per sale type:
   - `line` → one call, `saleType='line'`, `amount = doc.total_amount`
   - `device` → one call, `saleType='device'`, `amount = doc.total_amount`
   - `mixed` → split into line + device using `sales_doc_items`
     breakdown; if no items exist, split 50/50 as a fallback.

   Each call uses `source: 'sales_doc'` and
   `sourceSalesDocId: doc.id` so the commission row is linked back.

6. **Rollback on failure** — if `registerSaleCommission` throws (e.g.
   month is locked → DB trigger), the doc is flipped back to `rejected`
   with the error as `rejection_reason`, an event is logged, and a 500
   is returned.

7. **Audit event** — `sales_doc_events(event_type='submitted_and_synced')`
   with the commission ids and total employee commission attached.

Return shape:

```json
{
  "success": true,
  "data": {
    "doc": { ...sales_docs row... },
    "commissions": [
      { "id": 123, "contractCommission": 1.23, "employeeCommission": 1.23, "rateSnapshot": {...} }
    ]
  }
}
```

Source: [`app/api/pwa/sales/[id]/submit/route.ts`](../app/api/pwa/sales/%5Bid%5D/submit/route.ts).

---

## 6. Customer linking

Finding/creating a customer from phone input is one of the most
commonly-hit paths. Normalisation lives in
[`lib/pwa/customer-linking.ts`](../lib/pwa/customer-linking.ts) →
`buildCustomerPhoneCandidates`:

Input variants all normalise to the same set of candidates:

- `05XXXXXXXX` (Israeli mobile, local)
- `9725XXXXXXXX` (international, no plus)
- `+9725XXXXXXXX` (E.164)

`buildCustomerPhoneCandidates("054-111-2233")` returns the set of these
three variants. A `.in("phone", candidates)` query matches regardless of
how the phone was originally stored.

### Dedup rules (on create)

`POST /api/pwa/customers`:

1. If any row in `customers` matches any normalised phone candidate →
   return that customer with `existed: true`.
2. Else if `national_id` matches an existing row → return it.
3. Else INSERT a new `customers` row, `source: 'pwa'`.

Phone is normalised on insert (strips `-` and spaces; keeps leading `+`
if present).

### National ID

Optional (`national_id`). Agents are encouraged but not required to
capture it. When present, it acts as a secondary dedup key and lets
finance cross-reference with HOT Mobile records.

---

## 7. Idempotency

Two layers protect against duplicate rows under retries.

### `doc_uuid`

Stable client-generated UUID attached to `sales_docs.doc_uuid` (unique
index). Used to keep a client-side record of "this doc I created" even
if the server returned a network error. If the client retries the
create with the same `doc_uuid`, the UNIQUE constraint returns the
existing row (the API doesn't currently re-use it for idempotent
upserts; it just refuses the duplicate — this is acceptable because
`GET /api/pwa/sales` will still show the original).

### `idempotency_key`

Per-employee stable key on `sales_docs`. Partial unique index:

```sql
UNIQUE(employee_key, idempotency_key)
  WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL
```

The PWA client sets `idempotency_key = <timestamp>-<random>` on every
create call. For pipeline auto-creation (see `COMMISSIONS.md` §5.1), the
key is `pipeline_<deal_id>` so repeated "won" transitions don't spawn
duplicate docs.

---

## 8. Offline support

As of 2026-04-18, the PWA has **real offline support** for reads and
writes. The service worker at `public/sales-pwa/sw.js` owns the
caching + queueing; `lib/pwa/offline-client.ts` and
`stores/offline-store.ts` expose it to the UI.

### Reads — network-first cache

- **Navigation requests** — network-first, fall back to the cached
  shell. Agent can open the PWA with zero signal.
- **Static assets** — cache-first.
- **API GETs under `/api/employee/*` and `/api/pwa/sales*`** —
  network-first; the successful response is stored and served as the
  fallback on subsequent offline loads. Keeps the daily dashboard and
  commissions page usable when signal drops.

### Writes — IndexedDB POST queue

All `POST` / `PUT` to `/api/pwa/*` are wrapped by the service worker.
When offline, the request body is serialised into IndexedDB and a
placeholder 202 is returned so the UI keeps moving.

Queue schema:

```
db:       clalmobile-offline
store:    post-queue
keyPath:  id (auto-increment)
record:   { url, method, body, headers, queuedAt }
```

Drain triggers:

- `online` event — browser reports connectivity.
- `sync` tag — Background Sync API if available.
- `postMessage` from the page — e.g. when the user taps "retry now".

Every drained request is replayed server-side and its response is
`postMessage`d back to the page so the store can reconcile.

### UI helpers

- [`lib/pwa/offline-client.ts`](../lib/pwa/offline-client.ts) —
  `isOnline()`, `getQueueSize()`, `syncQueue()`, `getQueuedRequests()`.
- [`stores/offline-store.ts`](../stores/offline-store.ts) — Zustand
  store with `online` flag, pending-docs list, and subscribers for the
  top-level banner.
- [`components/pwa/ConnectionBanner.tsx`](../components/pwa/ConnectionBanner.tsx)
  — sticky yellow banner that appears when `!isOnline()` and shows the
  queue size + "retry now" button. **Flicker-free on mount**: the
  useEffect only calls `setOnline(navigator.onLine)` when it differs from
  the store's current value, so the banner never flashes when the two
  were already in sync (fix 2026-04-18).

### Idempotency with the queue

The `doc_uuid` + `idempotency_key` scheme (§7) is exactly what makes
queued replay safe. A create replayed twice (flaky connection + manual
retry) lands on the partial unique index and the second insert is a
no-op.

---

## 9. Commission details (`/sales-pwa/commissions`)

Replaces the old `/employee/commissions` page.

### Controls

- **Month picker** — dropdown of the last 12 months; default = current
  Asia/Jerusalem month. URL-synced.
- **Export PDF** — download link (see §12).

### Summary card

Reads `GET /api/employee/commissions?month=YYYY-MM`. Shows:

| Line | Meaning |
|------|---------|
| Lines commission | Sum of line-type commissions for the month |
| Devices commission | Sum of device-type commissions (post-milestone) |
| Loyalty bonus | Accrued loyalty payouts on mature lines |
| Milestone bonus | Device milestone deltas attributed to this employee |
| Sanctions | Total deductions |
| **Net** | Final take-home |

Amounts are real; rates are not. No rates from the contract ever leak
to the employee UI — only the absolute shekel amount.

### Sales table

One row per `commission_sales` row. Click-to-expand reveals a
calculation explanation string drawn from `rate_snapshot` at the time
of the sale (so historical sales explain themselves via the rates that
applied back then — see `docs/COMMISSIONS.md` §4).

Columns: date, type, amount, source badge, customer, commission.

### Milestones list

Each threshold crossing is one row: threshold number, date it was hit,
bonus earned.

### Chart

A 12-month **recharts** line chart plotting sales amount, commission
earned, and target per month. Hover tooltip shows the exact month and
values. Data from `GET /api/employee/chart`.

---

## 10. Calculator (`/sales-pwa/calculator`)

What-if commission preview. **Does not write anything to the ledger.**

- Sale type tab — `line` or `device`.
- Amount input — debounced; every change fires
  `POST /api/employee/calculator` with `{ saleType, amount }` and
  re-renders the result card.
- Result card — three numbers (`contractCommission`,
  `employeeCommission`, `ownerProfit`) plus an `explanation` string
  describing the calculation at a conceptual level.
- **Offline fallback** — if the request fails or the user is offline, a
  fully-client local calc runs using contract-default multipliers so
  the card still shows a sensible preview. The card labels the source
  (`local` vs `api`).
- **"Register this sale" button** — jumps to `/sales-pwa/new` with the
  type + amount pre-filled, so a salesperson can go from "what would
  this pay?" to actually submitting the sale in one click.

Source: [`app/sales-pwa/calculator/page.tsx`](../app/sales-pwa/calculator/page.tsx).

---

## 11. Corrections (`/sales-pwa/corrections`)

Employee-filed dispute workflow. See `docs/COMMISSIONS.md` §16 for the
data model and endpoints.

- **List** — own requests, newest first, status pill (pending / approved
  / rejected / resolved).
- **New-request modal** — picks a request type (6 options: amount_error,
  wrong_type, wrong_date, wrong_customer, missing_sale, other) and
  optionally pins to a specific sale or doc.
- **Detail** — shows the admin's response once resolved. A
  `correction_resolved` activity row fires into `/sales-pwa/activity` at
  the same time.

Admin responds from `/admin/commissions/corrections` — see
`docs/ADMIN.md`.

---

## 12. PDF export

`/api/employee/commissions/pdf?month=YYYY-MM` returns a PDF of the
month's commission breakdown.

- **Headings** in English (compatible with every renderer).
- **Arabic body** via the **Cairo** font shipped at
  `/public/fonts/cairo-regular.ttf`.
- **Font loading fallback chain**:
  1. `fetch('/fonts/cairo-regular.ttf')` from the same origin — works
     on Vercel and any static host.
  2. Node `fs.readFile(...)` from the bundled filesystem — local dev
     and edge cases.
  3. If neither works — fall back to **Helvetica** with English-only
     output (layout stays intact; Arabic rows show the transliterated
     customer name or skip).

The fallback chain is deliberately silent so a font-load failure never
produces an empty PDF; it degrades to English.

---

## 13. Activity timeline (`/sales-pwa/activity`)

Infinite-scroll timeline of the employee's activity log. One row per
event; newest first.

Each event has a type icon (via **lucide-react**):

| `event_type` | Icon |
|---|---|
| `sale_registered` | `DollarSign` (emerald) |
| `sale_cancelled` | `XCircle` (rose) |
| `sanction_added` | `AlertTriangle` (amber) |
| `target_set` / `target_updated` | `Target` (sky) |
| `milestone_reached` | `Trophy` (amber) |
| `correction_submitted` / `correction_resolved` | `FileEdit` / `CheckCircle2` (violet) |

The emoji in product-design mocks (💰 ❌ ⚠️ 🎯 🏆 📝) maps onto these
icons one-to-one.

Loads 50 rows per page from `GET /api/employee/activity?limit=50&offset=N`
via an `IntersectionObserver`-driven sentinel.

See `docs/COMMISSIONS.md` §18 for the write path.

---

## 14. Announcements (`/sales-pwa/announcements`)

Broadcast messages published by admin via `/admin/announcements`.

- **Priority colouring** — urgent → rose, high → amber, normal → slate,
  low → muted gray.
- **Ordering** — unread first, then by newest.
- **Read state** — expanding an unread announcement auto-POSTs
  `/api/employee/announcements/[id]/read` so the unread badge drops
  and the admin view shows the read count tick up.
- **Expiry** — announcements past `expires_at` are greyed out /
  hidden. Admin can set an indefinite expiry by leaving the field
  empty.

Data model: `admin_announcements` + `admin_announcement_reads`
(per-user join table). See `docs/ADMIN.md` for the authoring side.

---

## 15. Customer creation (details)

`POST /api/pwa/customers` — covered in §4 above. A quick reminder of
the dedup rules:

1. **Phone dedup** — `buildCustomerPhoneCandidates(input)` produces
   `+9725XXXXXXXX`, `9725XXXXXXXX`, and `05XXXXXXXX` variants; the
   query matches any of them.
2. **National-id dedup** — if supplied and matches an existing row,
   that customer is returned instead of inserting.
3. **Insert** — `source: 'pwa'`, phone normalised (strips `-`/space,
   keeps leading `+` if present).

Returns `{ customer, existed: boolean }`.

---

## 16. Row-level security (RLS)

Enabled on the whole `sales_docs` family in migration
`20260418000003_commission_refactor.sql`:

```sql
ALTER TABLE sales_docs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_doc_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_doc_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_doc_sync_queue   ENABLE ROW LEVEL SECURITY;
```

### Policies

- **`service_role` full access** — all API routes use `createAdminSupabase()`
  which authenticates as `service_role` and bypasses RLS. This is the
  main write path.
- **`authenticated` employee read-own** on `sales_docs`:

  ```sql
  USING (
    employee_key       = auth.uid()::text OR
    employee_user_id   = auth.uid()::text OR
    employee_user_id IN (SELECT id::text FROM users WHERE auth_id = auth.uid())
  )
  ```

  This is in place for future client-side direct-read scenarios; today
  the UI reads via the API, so the service-role policy is what's hit in
  practice.

### What this means in practice

If a future client bypasses the API and reads `sales_docs` directly
through the Supabase JS SDK with an authenticated user token, they will
only see their own rows. The API layer is the source of truth for
permission checks today, but RLS is the defence-in-depth layer.

---

## 17. Pipeline PWA integration

Sales docs aren't only created by field agents. CRM staff working the
**pipeline** also generate them — see `COMMISSIONS.md` §5.1. Those docs
get:

- `source = 'pipeline'` (vs `source = 'pwa'` for field-agent docs).
- `status = 'synced_to_commissions'` at creation time (no draft state —
  they skip the PWA lifecycle).
- `idempotency_key = pipeline_<deal_id>`.
- `employee_key` / `employee_user_id` = the deal's assigned employee or
  the actor who moved it to won.
- A `sales_doc_events(event_type='auto_created_from_pipeline')` event
  logging the deal_id and resulting commission_id.

From the employee portal's perspective these look like any other doc and
they count toward the same monthly totals. Managers can cancel them via
the same `/admin/sales-docs` cancel flow.

---

## 18. File & route reference

| Path | Role |
|------|------|
| `app/sales-pwa/layout.tsx` | Shell + SalesPwaInit (service worker registration). |
| `app/sales-pwa/page.tsx` | List page — uses `/api/pwa/sales`. |
| `app/sales-pwa/new/page.tsx` | Create-draft form. |
| `app/sales-pwa/docs/[id]/page.tsx` | Doc detail + submit button. |
| `components/pwa/SalesPwaInit.tsx` | Client-side service worker registration. |
| `public/sales-pwa/sw.js` | Service worker (static cache, nav fallback). |
| `public/sales-pwa/manifest.json` | PWA manifest (installability). |
| `lib/pwa/auth.ts` | `requireEmployee(req)` — Supabase SSR auth gate. |
| `lib/pwa/customer-linking.ts` | `buildCustomerPhoneCandidates`, `attachCustomersToSalesDocs`. |
| `lib/pwa/validators.ts` | Zod schemas for sales-doc creation / update. |
| `app/api/pwa/sales/route.ts` | List / create draft. |
| `app/api/pwa/sales/[id]/route.ts` | Detail / update (draft+rejected only). |
| `app/api/pwa/sales/[id]/submit/route.ts` | **Submit** → commission. |
| `app/api/pwa/customers/route.ts` | Create customer with dedup. |
| `app/api/pwa/customer-lookup/route.ts` | Phone / code lookup. |
| `supabase/migrations/20260410000001_sales_docs_pwa.sql` | Tables. |
| `supabase/migrations/20260418000003_commission_refactor.sql` | RLS + cancel state + source columns. |

---

## 19. Related docs

- `docs/COMMISSIONS.md` — what happens after submit.
- `docs/BOT.md` — WhatsApp bot (separate channel; creates pipeline
  leads, not sales_docs).

---

## 20. Data model

The unified PWA is backed by four additional tables (migration
`20260418000006_unified_employee_pwa.sql`):

- `commission_correction_requests` — employee-filed disputes (see
  `docs/COMMISSIONS.md` §16).
- `admin_announcements` + `admin_announcement_reads` — broadcast
  messages with per-user read state (see §14 above, and
  `docs/ADMIN.md`).
- `employee_activity_log` — personal audit timeline (see
  `docs/COMMISSIONS.md` §18).
- `employee_favorite_products` — quick-pick list for the new-sale form.

All four ship with RLS — employees only read/write their own rows;
admin endpoints using `service_role` bypass the policies.
