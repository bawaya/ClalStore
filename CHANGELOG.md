# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — 2026-04-18

### Added — Commission system refactor

- **Unified `registerSaleCommission`** — single entry point for awarding commissions across Pipeline, PWA, and manual sale flows (replaces three divergent call sites)
- **Admin sales-docs management** at `/admin/sales-docs` — attachment review, status transitions, signed-URL download
- **Employee commission portal** at `/employee/commissions` — personal commission ledger, target progress, sanctions history
- **Commission sync workflow** — `.github/workflows/commission-sync.yml` runs hourly at :30, pulls orders from the last cursor, awards commissions idempotently via `UNIQUE(order_id, sale_type)` + `ON CONFLICT DO NOTHING`
- **75 new tests** covering the unified commission path — zero regression on admin/employee UIs

### Added — Documentation

- Public docs set — `docs/I18N.md`, `docs/DEPLOYMENT.md`, `docs/MONITORING.md`, `docs/CHANGELOG.md`
- Enterprise documentation set under `docs/` — `TESTING.md`, `SECURITY.md`, `OPERATIONS.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `INCIDENT-RESPONSE.md`, `RUM-SETUP.md`
- `CHANGELOG.md` following the Keep a Changelog convention
- `.github/PULL_REQUEST_TEMPLATE.md` and issue templates

### Fixed

- **Commission sync migration** — dropped partial unique index in favor of a plain `UNIQUE(order_id, sale_type)` so `ON CONFLICT` can target it cleanly
- **`onConflict` clause** in `sync-orders.ts` now matches the real `UNIQUE(order_id, sale_type)` constraint (previously targeted a column tuple that didn't match any index)
- **`commission_sales.employee_id` type** — migration corrected to treat the column as UUID, removed the stray `::text` cast that was breaking joins
- Legacy Cloudflare Pages build no longer crashes — `scripts/prepare-pages.mjs` stubbed for back-compat
- Status page deploy migrated to GitHub Pages native API (was publishing via an orphan branch)

### Changed

- `README.md` updated to reflect the six-layer testing strategy and documentation hub
- Commission award flow now emits a single unified event shape — downstream reports and exports only need to read one schema

---

## [1.5.0] — 2026-04-18

### Added — Phase 5 · Observability

- **Synthetic user journeys** (`tests/synthetic/user-journeys.spec.ts`) — 17 Playwright tests that hit production every 30 minutes via `.github/workflows/synthetic.yml`
- **Alert deduplication** (`tests/monitor/alert-dedup.js`) — uses GitHub Issues as state store to prevent duplicate notifications during an ongoing outage; includes auto-recovery notification
- **Public status page** (`tests/monitor/publish-status.js` + `.github/workflows/publish-status.yml`) — publishes `status.json` + `history.json` + `index.html` to the `status-page` branch every 15 minutes, served via GitHub Pages at `https://bawaya.github.io/ClalStore/`
- **RUM documentation** (`docs/RUM-SETUP.md`) — Cloudflare Web Analytics + Sentry setup paths

### Changed

- `monitor.yml` and `smoke.yml` migrated from the old one-shot alerter to the deduplicated alerter; both now send a recovery notification on success

---

## [1.4.0] — 2026-04-18

### Security — Phase 4 · Hardening

- **Row-Level Security hardening** applied to production Supabase — `sub_pages`, `commission_sales`, `commission_targets`, `commission_sanctions`, `commission_sync_log`, `commission_employees`, `employee_commission_profiles`, `audit_log`, plus explicit service-role-only policies on `orders`, `order_items`, `customers`
- Closed **real RLS leaks** caught by the staging contract tests:
  - `sub_pages` — anon could INSERT / UPDATE / DELETE / read hidden
  - `commission_sales` — anon could SELECT all financial rows (RLS wasn't enabled)
  - `orders` — `orders_public_insert WITH CHECK (true)` let anon POST arbitrary orders
- Migration files: `supabase/migrations/20260417000001_fix_sub_pages_rls.sql`, `20260418000001_harden_rls_global.sql`, `20260418000002_harden_rls_followup.sql`
- Dropped `FORCE ROW LEVEL SECURITY` on FK-target tables (it was breaking Postgres's internal FK validation by not exempting `BYPASSRLS` roles); kept on `sub_pages` and `audit_log` only

### Added

- **RLS contract tests** (`tests/staging/rls-contract.test.ts`) — 17 tests that probe each sensitive table as the `anon` role and verify RLS enforces privacy; these tests caught the leaks above
- **Chaos tests** (`tests/unit/lib/chaos.test.ts`) — 18 tests covering graceful degradation when Supabase/yCloud/AI providers fail with ECONNREFUSED / 5xx / timeout
- **CodeQL** (`.github/workflows/codeql.yml`) — SQL injection, XSS, SSRF, prototype pollution scan on every push/PR + weekly
- **gitleaks + `npm audit`** (`.github/workflows/security.yml`) — secret scan + HIGH/CRITICAL CVE gate with allowlist
- **Stryker mutation testing** (`.github/workflows/mutation.yml`) — 20 lib/ files, weekly
- **Dependabot** (`.github/dependabot.yml`) — grouped PRs weekly
- `.github/audit-allowlist.json` + `.github/audit-check.js` — known-unfixable CVE allowlist with expiry

### Fixed

- `next` bumped from 15.5.14 to 15.5.15 to patch GHSA-q4gf-8mx6-v5v3 (Denial of Service via Server Components); then rolled back to 15.5.14 due to React 18/19 incompatibility, allowlisted with a short expiry forcing revisit after react-dom 19 migration
- `lighthouse` downgraded to `^12` for Cloudflare Worker build compatibility (Node 22.16)

---

## [1.3.0] — 2026-04-18

### Added — Phase 3 · Visual + Performance + Accessibility

- **Visual regression** (`tests/e2e/visual-regression.spec.ts` + `.github/workflows/visual-regression.yml`) — 120 Playwright snapshots (20 pages × 3 viewports × 2 languages); compare mode fails PRs with > 1% drift, update mode regenerates baselines
- **Lighthouse CI** (`lighthouserc.json` + `.github/workflows/lighthouse.yml`) — performance budgets on 5 key URLs; accessibility ≥ 0.85 and CLS < 0.15 are hard blocks
- **Expanded accessibility tests** (`tests/e2e/a11y-expanded.spec.ts`) — 12 public pages × axe-core WCAG2 AA + keyboard nav + RTL invariants + image alt checks

### Changed

- Phase 2 CI now enforces Playwright E2E (removed `continue-on-error: true`); failures block merges

---

## [1.2.0] — 2026-04-17

### Added — Phase 2 · CI-enforced E2E

- `.github/workflows/test.yml` — full CI pipeline: lint/TS → unit/integration → E2E → build
- `tests/ci/mock-supabase.mjs` — 100-line mock HTTP server for Supabase REST/Auth/Storage, lets Next.js build + render without a live DB in CI
- Playwright browser caching in CI
- Node version pinned to 22.19 via `.nvmrc` and `.node-version`

### Changed

- `lib/admin/auth.ts` coverage raised from 14% → 98%
- `lib/commissions/sync-orders.ts` coverage raised from 2.67% → 98.21%
- `lib/commissions/ledger.ts` coverage raised from 43.75% → 95.62%
- `lib/supabase.ts` coverage raised from 3.84% → 100%

### Fixed

- `tests/e2e/tablet-flow.spec.ts` — replaced `devices["iPad Mini"]` (WebKit) with chromium viewport emulation so CI doesn't need webkit
- `tests/e2e/auth-flow.spec.ts` — login and customer-auth tests tolerate loading skeleton OR form (CI mock-supabase means Supabase SSR takes a beat)
- `tests/e2e/performance.spec.ts` — tolerate HTTP 429 from autocomplete under CI load

---

## [1.1.0] — 2026-04-17

### Added — Phase 1 · Coverage on critical paths

- `tests/unit/lib/commissions-sync-orders.test.ts` — 22 new tests (file previously had 0% coverage)
- `tests/unit/lib/supabase.test.ts` — 11 new tests
- `tests/unit/lib/admin-auth.test.ts` expanded with `requireAdmin`, `withAdminAuth`, `withPermission`, `logAudit` scenarios (26 → 45 tests)
- `tests/unit/lib/commissions-ledger.test.ts` expanded with async DB paths (24 → 49 tests)

### Changed

- Test count: 2514 → 2584 tests (+70)

---

## [1.0.0] — 2026-04-17

### Added — Initial six-layer testing system

- **Layer 1 · Unit & Integration** — 2505 Vitest tests across 155 files covering `lib/`, API routes, components, pages, layouts, middleware, migrations, i18n, types, configs, scripts
- **Layer 2 · CI** — `.github/workflows/test.yml` with lint/TS/unit/e2e/build jobs
- **Layer 3 · Staging** — `tests/staging/` running against real Supabase with `TEST_`-prefixed data
- **Layer 4 · Production smoke** — `tests/smoke/` running against `clalmobile.com` daily + post-deploy
- **Layer 5 · Hourly monitor** — `.github/workflows/monitor.yml` + `tests/monitor/check.js`
- **Layer 6 · E2E** — Playwright tests covering store, admin, CRM, mobile, tablet, i18n, accessibility, performance, PWA, website, auth, chat widget
- 14 shared test helpers (`tests/helpers/`) for mocking Supabase, requests, factories, WhatsApp, payments, AI, storage, SMS, email, external APIs, push, components, DB test utils
- Playwright config with 4 projects (desktop-chrome, mobile-pixel, tablet-ipad, webkit)

### Security fixes

- Applied `supabase/migrations/20260417000001_fix_sub_pages_rls.sql` — explicit role-scoped policies for `sub_pages`
- Added `RESEND_API_KEY` integration for production alerting (replaced placeholder SendGrid config)
- Rotated `CRON_SECRET` + paste into Cloudflare Worker for `/api/cron/*` authentication

### Fixed

- Cloudflare Worker build failures — removed stray submodule entry, downgraded `lighthouse` to v12 for Node compatibility
- Type-system parity between tests and strict TypeScript config

---

## Versioning note

We use semantic versioning informally:
- **MAJOR** — breaking changes to API surface or DB schema that require coordinated deploy + migration
- **MINOR** — new features, test coverage, or docs that are additive
- **PATCH** — bug fixes, dependency bumps, RLS/security fixes
