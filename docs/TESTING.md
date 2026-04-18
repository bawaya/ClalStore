# Testing Guide

> ClalMobile follows a **6-layer testing strategy** modeled after the practices of large SaaS engineering organizations. Every code change passes through at least three of these layers before reaching production.

## Table of Contents

- [Philosophy](#philosophy)
- [The six layers at a glance](#the-six-layers-at-a-glance)
- [Layer 1 — Unit & Integration (Vitest)](#layer-1--unit--integration-vitest)
- [Layer 2 — CI on every PR](#layer-2--ci-on-every-pr)
- [Layer 3 — Staging against real Supabase](#layer-3--staging-against-real-supabase)
- [Layer 4 — Production smoke](#layer-4--production-smoke)
- [Layer 5 — Hourly monitoring](#layer-5--hourly-monitoring)
- [Layer 6 — Synthetic user journeys](#layer-6--synthetic-user-journeys)
- [Security & quality scans](#security--quality-scans)
- [Mutation testing](#mutation-testing)
- [Visual regression](#visual-regression)
- [Lighthouse performance budgets](#lighthouse-performance-budgets)
- [Writing new tests](#writing-new-tests)
- [Running tests locally](#running-tests-locally)
- [Debugging failures](#debugging-failures)

---

## Philosophy

Four non-negotiables govern every test we write:

1. **No real external calls in unit/integration tests.** WhatsApp, payment gateways, AI providers, and email providers are always mocked in Layers 1–2. Only staging (Layer 3) touches real Supabase with `TEST_`-prefixed data that is cleaned up automatically.
2. **Fail loudly, not silently.** `continue-on-error: true` is forbidden in CI. If a test flakes repeatedly, we fix it or delete it — we don't mask it.
3. **Security tests are first-class.** RLS policies, CSRF validation, webhook signature verification, and rate limiting are tested at every layer.
4. **Tests document intent.** Test names read as English sentences describing the contract; assertion messages explain what was expected when they fail.

---

## The six layers at a glance

| # | Layer | What it proves | Where it runs | When |
|---|-------|----------------|---------------|------|
| 1 | **Unit & Integration** (Vitest) | Pure logic is correct, API handlers produce the right shape, hooks work in isolation | Local + CI | Every file save + every commit |
| 2 | **CI** (`test.yml`) | Nothing regresses in lint / TS / unit / build / E2E | GitHub Actions | Every push (non-main), every PR |
| 3 | **Staging** (`staging.yml`) | Real Supabase accepts our queries, RLS policies behave as designed | GitHub Actions | Every push to `main`, manual dispatch |
| 4 | **Smoke** (`smoke.yml`) | `clalmobile.com` is up and serves expected endpoints | GitHub Actions | Post-deploy + daily 06:00 UTC |
| 5 | **Hourly monitor** (`monitor.yml`) | SSL valid, homepage/store/API reachable within 5 s | GitHub Actions | Every hour |
| 6 | **Synthetic journeys** (`synthetic.yml`) | Real user flows end-to-end on production | GitHub Actions | Every 30 minutes |

---

## Layer 1 — Unit & Integration (Vitest)

### Scope

- **2889 tests** across **175 files** (up from 2722 / 166 before the 2026-04-18 employee-portal work; file count held steady after the attachments-system removal because deleted attachment tests were replaced in-file with behaviour tests for the "no attachment check" submit path)
- `tests/unit/` — pure functions (validators, calculators, formatters, state stores)
- `tests/integration/api/` — Next.js route handlers with mocked Supabase
- `tests/component/` — React components with `@testing-library/react`
- `tests/pages/` — Page components
- `tests/layouts/` — Root/admin/crm/store layouts
- `tests/middleware/` — `middleware.ts` behavior
- `tests/db/` — Migration file sanity + RLS policy shape
- `tests/i18n/` — `ar.json` / `he.json` key parity
- `tests/types/` — TypeScript type assertions

### Tooling

- **Runner:** Vitest 4 with `jsdom` environment
- **Pool:** `forks` with `maxForks: 4` (parallel), `execArgv: --max-old-space-size=2048`
- **Coverage:** `@vitest/coverage-v8`

### New suites — 2026-04-18

Seven new test files (152 new tests) landed with the unified Sales PWA + employee-portal work:

| File | Layer | Scope |
|------|-------|-------|
| `tests/pages/forgot-password.test.tsx` | Page | Forgot-password form — email validation, submit, success message, error states, no account-enumeration in response |
| `tests/pages/reset-password.test.tsx` | Page | Reset-password form — token handling, password strength, mismatch error, redirect on success |
| `tests/integration/pipeline-commission-flow.test.ts` | Integration | End-to-end: pipeline deal → `won` → `registerSaleCommission` writes a `commission_sales` row with `source='pipeline'` + `source_pipeline_deal_id` + snapshot |
| `tests/integration/pwa-commission-flow.test.ts` | Integration | PWA sales-doc submit → commission row created with `source='sales_doc'`; rollback path when commission insert fails |
| `tests/integration/commissions-full-flow.test.ts` | Integration | Multi-source commission correctness: manual + pipeline + PWA + order-sync all produce the right rows under `UNIQUE(order_id, sale_type)` |
| `tests/integration/admin-cancel-flow.test.ts` | Integration | Admin cancel endpoint: soft-deletes commissions, records reason, respects the month-lock trigger (`423 Locked` on locked months) |
| `tests/integration/admin-announcements-corrections.test.ts` | Integration | Admin publishes announcement; `read_count` increments via employee `POST /read`; correction lifecycle `pending → approved/rejected/resolved` with `employee_activity_log` and `audit_log` writes |
| `tests/integration/employee-app-endpoints.test.ts` | Integration | Every `/api/employee/*` route: profile, dashboard, chart, details, calculator, export (PDF headers), corrections, announcements, activity, announcements-read |
| `tests/unit/commission-date-utils.test.ts` | Unit | `lib/commissions/date-utils.ts` — `lastDayOfMonth`, `countWorkingDays`, timezone anchoring; covers the Israel work-week fix |

### Bugs surfaced by tests

Two code-level bugs were caught by the new suites and fixed in the same batch of commits:

1. **`countWorkingDays` excluded only Saturday** — Israel's work-week is Sunday through Thursday (weekend = Friday + Saturday). The helper in `lib/commissions/date-utils.ts` was only excluding Saturday, inflating target-pace calculations every week. `tests/unit/commission-date-utils.test.ts` reproduced the drift and the fix extended the weekend skip to both days.
2. **PDF export silently downgraded to Helvetica on Cloudflare Workers** — `app/api/employee/commissions/export/route.ts` was loading the Cairo font with `readFileSync`, which does not exist on the Workers runtime. The `try/catch` swallowed the error, so every production PDF was English-only without logging. The fix switched to a same-origin `fetch('/fonts/cairo-regular.ttf')` against Cloudflare's asset binding with an `fs.readFile` fallback for local Node dev. Helvetica is retained as a last-resort fallback only. Covered end-to-end by `tests/integration/employee-app-endpoints.test.ts`.

### Critical-file coverage gates

| File | Minimum coverage | Rationale |
|------|------------------|-----------|
| `lib/admin/auth.ts` | ≥ 85% | Controls every admin permission check |
| `lib/commissions/sync-orders.ts` | ≥ 85% | Sales team's pay depends on correctness |
| `lib/commissions/ledger.ts` | ≥ 85% | Month lock, recalc, allocation math |
| `lib/supabase.ts` | 100% | Every DB call depends on this |

### Run locally

```bash
# Full suite (~20 s)
npx vitest run

# Single file
npx vitest run tests/unit/lib/validators.test.ts

# Watch mode for TDD
npx vitest

# With coverage (slower)
npx vitest run --coverage
```

### Example structure

```typescript
// tests/unit/lib/validators.test.ts
import { describe, it, expect } from "vitest";
import { validateIsraeliID } from "@/lib/validators";

describe("validateIsraeliID", () => {
  it("accepts valid 9-digit IDs", () => {
    expect(validateIsraeliID("123456782")).toBe(true);
  });

  it("rejects IDs with wrong checksum", () => {
    expect(validateIsraeliID("123456789")).toBe(false);
  });
});
```

---

## Layer 2 — CI on every PR

### File

`.github/workflows/test.yml` — 4 parallel jobs that must all pass before merge:

| Job | Script | Typical duration |
|-----|--------|------------------|
| **Lint & TypeScript** | `npx tsc --noEmit && npx eslint .` | 1 min |
| **Unit & Integration** | `npx vitest run --coverage` | 2 min |
| **Playwright E2E** | Full Next.js build + live Playwright run | 4 min |
| **Build check** | `npm run build:next` | 1 min |

### Blocking rules

- TypeScript errors → blocking
- ESLint warnings → non-blocking (flagged but allowed; tighten when backlog zeroes)
- Unit test failure → blocking
- Playwright failure → blocking (88 scenarios on chromium-desktop)
- Build failure → blocking

### Supabase stubbing in CI

CI uses a 100-line mock at `tests/ci/mock-supabase.mjs` listening on `127.0.0.1:54321`. It responds to Supabase REST / Auth / Storage paths with empty-but-valid shapes so Server Components render empty-state UI instead of crashing on `ECONNREFUSED`.

---

## Layer 3 — Staging against real Supabase

### File

`.github/workflows/staging.yml`

### What it proves

| Spec | Count | Purpose |
|------|-------|---------|
| `tests/staging/db-operations.test.ts` | 8 | CRUD lifecycle (products, orders, customers, inbox) on real DB |
| `tests/staging/api-live.test.ts` | 4 | Live HTTP API endpoints return valid shapes |
| `tests/staging/whatsapp-test.test.ts` | 2 | yCloud API reachable, webhook payload persists |
| `tests/staging/email-test.test.ts` | 1 | Resend API accepts a plaintext email |
| `tests/staging/storage-test.test.ts` | 1 | R2 + Supabase Storage round-trip (upload → verify → delete) |
| `tests/staging/rls-contract.test.ts` | **17** | Row-level security enforces privacy for `anon` role |

### Test data safety

- Every row inserted is prefixed `TEST_` (see `TEST_PREFIX` in `tests/helpers/db-test-utils.ts`)
- `createStagingData()` calls `cleanupStagingData()` first → idempotent re-runs
- `afterAll` hook always runs `cleanupStagingData()`, even on test failure
- Phone numbers and emails use time-based unique suffixes to avoid unique-constraint collisions

### RLS contract tests — the jewel

These 17 tests connect as anonymous (anon key) to Supabase and probe every sensitive table:

```typescript
it("anon CANNOT read commission_sales", async () => {
  const { data } = await anon.from("commission_sales").select("id").limit(1);
  if (data && data.length > 0) throw new Error("RLS leak: anon read commission data");
});
```

These tests **caught real production vulnerabilities** during Phase 4 — see `supabase/migrations/20260418000001_harden_rls_global.sql` and `20260418000002_harden_rls_followup.sql` for the fix history.

### Run locally

```bash
# Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
bash tests/staging/run-staging.sh
```

---

## Layer 4 — Production smoke

### File

`.github/workflows/smoke.yml`

### What it checks (33 assertions)

| Suite | Covers |
|-------|--------|
| `tests/smoke/health.test.ts` | Homepage, `/api/health`, `/store`, `/admin` (auth gate), `/robots.txt`, `/sitemap.xml` |
| `tests/smoke/store.test.ts` | 14 public pages render + `/api/store/*` endpoints return valid JSON |
| `tests/smoke/performance.test.ts` | Homepage < 3 s, store API < 1 s, body size < 5 MB |
| `tests/smoke/ssl-headers.test.ts` | HTTPS enforced, HTTP redirects, security headers present |

### Trigger

1. GitHub `deployment_status` event with `state == 'success'` (post-deploy)
2. Manual `workflow_dispatch`
3. Daily 06:00 UTC cron

### On failure

Routes through `tests/monitor/alert-dedup.js` → deduplicated WhatsApp + email (see [Alert deduplication](#alert-deduplication)).

---

## Layer 5 — Hourly monitoring

### File

`.github/workflows/monitor.yml` + `tests/monitor/check.js`

### Checks every hour

- Homepage reachable in < 5 s
- `/api/health` status is `healthy` or `degraded` (401 is OK if token-gated)
- `/api/settings/public` returns JSON
- `/store` loads
- SSL cert valid and > 14 days from expiry

### Status page publishing

A sister workflow `publish-status.yml` runs every 15 minutes, writes `status.json` + `history.json` (last 168 snapshots = 7 days × 24 hours), and commits to the `status-page` branch for GitHub Pages serving at:

```
https://bawaya.github.io/ClalStore/
```

The status page shows a live status pill (up / degraded / down), per-service response times, and a 7-day sparkline.

### Alert deduplication

`tests/monitor/alert-dedup.js` uses GitHub Issues as the state store:

| Scenario | Action |
|----------|--------|
| First failure | Create `alert:active` issue + send WhatsApp + email |
| Still failing (< 2 h since last notify) | Append comment to issue (no outbound notify) |
| Still failing (≥ 2 h) | Send WhatsApp + email escalation |
| Recovered | Close issue + send recovery notification |

---

## Layer 6 — Synthetic user journeys

### File

`.github/workflows/synthetic.yml` + `tests/synthetic/user-journeys.spec.ts`

Runs every **30 minutes** against `clalmobile.com` with Playwright chromium. 17 scenarios across:

- **Shopping journey** — homepage → search → product → cart attempt (no real checkout)
- **Public content** — 6 static pages load with content ≥ 500 chars
- **Core API endpoints** — `/api/settings/public`, `/api/store/smart-search`, `/api/reviews/featured`, `/robots.txt`, `/sitemap.xml`
- **Auth gate** — `/admin` and `/crm` redirect or show login
- **i18n invariants** — HTML has valid `lang` and RTL `dir`

### Safety rules

1. **Never complete a real purchase** — payment gateway submission is forbidden in synthetic tests
2. **Never OTP a real phone** — use the dedicated `WHATSAPP_TEST_NUMBER` secret
3. **Never modify admin data** — synthetic tests are read-only against the admin

---

## Security & quality scans

### File

`.github/workflows/codeql.yml` + `.github/workflows/security.yml`

| Scanner | What it catches | Cadence |
|---------|-----------------|---------|
| **CodeQL** | SQL injection, XSS, SSRF, prototype pollution, insecure deserialization | Push + PR + weekly Monday 05:00 UTC |
| **gitleaks** | Committed API keys, JWTs, private keys | Push + PR + daily 03:00 UTC |
| **npm audit** (allowlist-aware) | HIGH/CRITICAL CVEs in production deps | Push + PR + daily 03:00 UTC |
| **Dependabot** | Outdated packages (grouped by ecosystem) | Weekly Monday |

### Audit allowlist

Unfixable vulnerabilities (e.g., `xlsx` has no upstream patch) live in `.github/audit-allowlist.json` with a required `reason` and `expires` date. CI breaks if an allowlist entry expires or if a HIGH/CRITICAL vuln appears that isn't listed.

```json
{
  "package": "xlsx",
  "severity": "high",
  "reason": "No upstream patch. Admin-side exports only, not exposed to untrusted input.",
  "expires": "2026-10-01"
}
```

---

## Mutation testing

### File

`.github/workflows/mutation.yml` + `stryker.config.mjs`

**Stryker** runs weekly (Sundays 04:00 UTC) against 20 hand-picked `lib/` files. It introduces mutations (changes `===` to `!==`, drops conditions, etc.) and verifies each is caught by at least one test.

### Thresholds

- **Break:** < 50% → build fails
- **Low:** < 60% → warning
- **High:** ≥ 80% → goal

### When to run manually

```bash
# All configured files
npx stryker run

# Just one file (fast iteration)
npx stryker run --mutate lib/validators.ts
```

---

## Visual regression

### File

`.github/workflows/visual-regression.yml` + `tests/e2e/visual-regression.spec.ts`

**120 snapshots** across 20 pages × 3 viewports (mobile / tablet / desktop) × 2 languages (ar / he). Generated and compared in CI on Linux chromium — baselines from developer laptops always differ due to font rendering.

### Run modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| `compare` (default) | PR touching `app/`, `components/`, `styles/`, or tailwind config | Fails if any snapshot diff > 1% |
| `update` | Manual workflow_dispatch | Regenerates all baselines and commits them |

---

## Lighthouse performance budgets

### File

`.github/workflows/lighthouse.yml` + `lighthouserc.json`

**Runs on every PR that touches UI code.** Tests 5 critical URLs with 2 runs each:

| Metric | Threshold | Severity |
|--------|-----------|----------|
| Accessibility score | ≥ 0.85 | **error** (blocks PR) |
| CLS | < 0.15 | **error** (blocks PR) |
| Performance score | ≥ 0.70 | warn |
| LCP | < 4 s | warn |
| TBT | < 500 ms | warn |
| FCP | < 2.5 s | warn |

---

## Writing new tests

### Where does my test go?

| Testing... | Directory | Pattern |
|------------|-----------|---------|
| Pure function in `lib/` | `tests/unit/lib/` | `<filename>.test.ts` |
| API route handler | `tests/integration/api/` | `<route-name>.test.ts` |
| React component | `tests/component/` | `<ComponentName>.test.tsx` |
| Page (`app/.../page.tsx`) | `tests/pages/` | `<page-name>.test.tsx` |
| Migration SQL | `tests/db/migrations.test.ts` | Add to existing file |
| RLS policy | `tests/staging/rls-contract.test.ts` | Add new `describe` block |
| Production flow | `tests/synthetic/user-journeys.spec.ts` | Add new `test()` |

### Mocking external services

Use the shared helpers in `tests/helpers/`:

```typescript
import {
  createMockRequest,
  createMockSupabaseClient,
  installWhatsAppFetchMock,
  installPaymentFetchMock,
  installAIFetchMock,
  makeCustomer,
  makeOrder,
} from "@/tests/helpers";
```

See `tests/helpers/index.ts` for the full export list.

### Naming

Good:
```typescript
it("returns 403 when sales role tries to delete a product", () => { ... });
```

Not good:
```typescript
it("test 1", () => { ... });
it("should work", () => { ... });
```

---

## Running tests locally

```bash
# Layer 1 — fastest feedback loop
npx vitest                                     # watch mode
npx vitest run                                 # single pass
npx vitest run --coverage                      # with coverage
npx vitest run tests/unit/lib/validators.test.ts

# Layer 2 — full CI equivalent locally
npx tsc --noEmit
npx vitest run
npm run build:next
npx playwright test --project=chromium-desktop

# Layer 3 — staging (needs real Supabase creds in .env.local)
bash tests/staging/run-staging.sh

# Layer 4 — smoke on production
npx vitest run --config vitest.smoke.config.ts

# Layer 5 — one-shot production check
node tests/monitor/check.js

# Layer 6 — synthetic journeys on production
npx playwright test --config=playwright.synthetic.config.ts

# Visual regression (requires running Next.js server)
npx playwright test --grep "@visual"

# Mutation testing (slow, 15+ min)
npx stryker run
```

---

## Debugging failures

### Vitest: test times out

Most common cause: `then` on the mocked Supabase chain is a `vi.fn()` instead of a real thenable. Fix:

```typescript
// Wrong
then: vi.fn().mockResolvedValue({ data, error: null })

// Right
then: (resolve) => resolve({ data, error: null })
```

### Playwright: `browserType.launch: Executable doesn't exist at .../webkit-...`

Our CI installs only chromium. If a spec uses `devices["iPad Mini"]` or `devices["Desktop Safari"]` it forces WebKit. Fix by using chromium-based viewport emulation.

### Staging: `foreign key violation`

Usually means the row you're FK-ing to was deleted by an afterAll hook from a concurrent or previous test run. Check:

1. Is your `useStagingFixtures()` call at the top of the describe?
2. Are you using `stagingCtx.productIds[0]` vs a stale literal UUID?

### CI: `npm ci` fails with `EBADENGINE`

A dependency requires a newer Node. Check `.nvmrc` and the matrix of all workflow files (all must match).

### Smoke / Monitor: 401 on `/api/health`

Expected — the endpoint is Bearer-token gated. The test treats 401 as "ok, auth working" and moves on.

### Synthetic: test flakes intermittently

Playwright retries 3× before alerting (configured in `playwright.synthetic.config.ts`). If a single test flakes > 30% of runs, either tighten its selectors or mark it `test.skip` with a dated TODO.

---

## Quick reference

```bash
# Run all local layers in sequence
npx tsc --noEmit \
  && npx vitest run \
  && npm run build:next \
  && echo "✓ local CI equivalent passes"
```

For CI/CD status of each layer, see the live status page at `https://bawaya.github.io/ClalStore/` (refreshes every 15 min).
