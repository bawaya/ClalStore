# Agent Guide — ClalMobile

> Canonical conventions for any AI agent (Claude, Copilot, Cursor) and any human contributor touching this codebase. Read this top-to-bottom once, then use it as lookup.

## Stack
Next.js 15 App Router · TypeScript (strict) · Tailwind CSS 3 · Supabase (Postgres + Auth + Storage) · Cloudflare Workers via OpenNext (edge) · Zod 4 validation · Zustand state · Vitest testing.

## Architecture

| Area | Path | Purpose |
|------|------|---------|
| **Public Store** | `app/store/` | E-commerce storefront (products, cart, checkout, wishlist, compare, tracking) |
| **Admin Panel** | `app/admin/` | Product/order/content management, analytics, bot config, push notifications, sales-docs, commission corrections, announcements |
| **CRM** | `app/crm/` | Inbox, customers, chats, orders, tasks, pipeline, reports, team users |
| **Sales PWA** | `app/sales-pwa/` | Unified employee app — dashboard, commissions, calculator, corrections, activity, announcements, documentation. Replaces the former `/employee/commissions` (now a 308 redirect). |
| **Auth pages** | `app/(auth)/` | `login/`, `forgot-password/`, `reset-password/` — single Supabase auth shared by admin, CRM, and Sales PWA |
| **API Routes** | `app/api/` | Route handlers grouped by `admin/`, `employee/`, `pwa/`, `crm/`, `store/`, `webhook/`, `payment/`, `cron/`, `health/` — see `docs/API-REFERENCE.md` |
| **Business Logic** | `lib/` | Domain logic: `lib/store/`, `lib/admin/`, `lib/crm/`, `lib/bot/`, `lib/ai/`, `lib/commissions/`, `lib/employee/`, `lib/integrations/`, `lib/pwa/` |
| **Components** | `components/` | UI by domain: `store/`, `admin/`, `crm/`, `chat/`, `website/`, `shared/`, `ui/`, `pwa/` |
| **Stores** | `stores/` | Zustand stores — e.g. `stores/offline-store.ts` for PWA offline state |
| **DB Types** | `types/database.ts` | 60+ table types — single source of truth for the Supabase schema |
| **Migrations** | `supabase/migrations/` | Sequential SQL migrations — never edited in place |
| **i18n** | `locales/` | Hebrew (`he.json`) + Arabic (`ar.json`) — RTL bilingual UI |
| **Fonts** | `app/fonts.ts` + `public/fonts/` | `next/font/google` (Heebo, Tajawal, David Libre) applied on `<html>`; `public/fonts/cairo-regular.ttf` bundled for server-side Arabic PDF export |
| **Public URL helper** | `lib/public-site-url.ts` | `getPublicSiteUrl()` for redirects, webhooks, admin links (not for PDF print popups — those may still load Google Fonts) |

### New / notable modules (2026-04-18)

| Module | What it does |
|---|---|
| `lib/commissions/register.ts` | **Single entry point** for commission creation. `registerSaleCommission(db, input)` — used by Pipeline, Sales PWA, and hourly sync. Persists `rate_snapshot` for historical accuracy and fires an activity-log entry. |
| `lib/commissions/date-utils.ts` | `countWorkingDays(from, to)` (Sunday–Thursday only, excludes Fri+Sat), `lastDayOfMonth(month)`. **Always use these** — never hardcode `${month}-31` for month boundaries. |
| `lib/employee/activity-log.ts` | `logEmployeeActivity(db, input)` — non-throwing fire-and-forget. Called from every commission-touching code path (register, cancel, sanction, target edit, milestone hit, correction lifecycle). Surfaces in `/sales-pwa/activity`. |
| `components/pwa/SalesPwaShell.tsx` | Unified shell for `/sales-pwa/*` — bottom nav on mobile, sidebar on desktop. Header pulls the employee name from `/api/employee/me`. |
| `components/pwa/ConnectionBanner.tsx` | Offline banner driven by the Zustand offline store. |
| `stores/offline-store.ts` | Zustand offline state (online flag, queue size). |
| `lib/pwa/offline-client.ts` | `isOnline`, `getQueueSize`, `syncQueue` — IndexedDB queue for `/api/pwa/*` POST replay on reconnect. |

## Build & Test
```
npm install              # Node >=18.17.0
npm run dev              # Dev server
npm run build            # Production build
npm run build:cf         # OpenNext Cloudflare bundle (run `npm run build` first unless using deploy:cf)
npm run deploy:cf        # `next build` + OpenNext + `wrangler deploy`
npm run lint             # ESLint
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run test             # Vitest watch
npm run test:run         # Vitest single run
npm run test:coverage    # Coverage report
npm run test:run -- tests/unit/auth.test.ts           # One file
npm run test:run -- tests/unit/auth.test.ts -t "name" # One test
npm run db:migrate       # Push migrations to Supabase
npm run db:seed          # Seed data
npm run db:reset         # Reset DB
```

## Code Style
- Prettier: 2 spaces, semicolons, double quotes, trailing commas, max width 100.
- Import order: framework/external → `@/*` aliases → relative. Keep imports minimal.
- Naming: `PascalCase` components, `camelCase` vars/functions, `UPPER_SNAKE_CASE` constants.
- Route files export HTTP method handlers: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.

## Conventions

### API Routes
- Validate input with Zod schemas via `validateBody()` from `lib/admin/validators.ts`.
- Return structured responses via `apiSuccess(data)` / `apiError(msg, status)` from `lib/api-response.ts`.
- Admin routes: call `requireAdmin(request)` from `lib/admin/auth.ts` first.
- CRM routes: check auth via middleware (auto 401 for `/api/crm/*`).
- Never expose `err.message` in production responses — use generic errors.

### Auth & Security
- Supabase Auth for sessions; `users` table for roles/permissions. A single Supabase auth covers admin, CRM, and the Sales PWA.
- 6 roles: `super_admin` > `admin` > `sales` > `support` > `content` > `viewer`.
- Permission check: `hasPermission(user, 'orders')` / `canAccessPage(user, '/admin/products')`.
- **Route guards**:
  - `/api/admin/*` → `requireAdmin` from `lib/admin/auth.ts` + per-permission checks.
  - `/api/employee/*` → `requireEmployee` from `lib/pwa/auth.ts` (any authenticated user with an `employee_commission_profiles` row).
  - `/api/pwa/*` → session + CSRF + employee guard.
- **Password recovery**: Supabase-driven. Request at `/forgot-password`, land on `/reset-password` from the recovery email. Applies to admin, CRM, and Sales PWA (single auth). Password strength rules mirror `/change-password`.
- Middleware enforces: auth gating, CSRF (double-submit cookie), rate limiting, security headers, CORS.
- CSRF exempt: `/api/webhook/*`, `/api/cron/*`, `/api/payment/callback`, `/api/csrf`, `/api/orders`.
- Open CORS (no session required): `/api/admin/commissions/summary`, `/api/admin/commissions/dashboard` — these accept bearer token auth via `COMMISSION_API_TOKEN` env var.
- Never hardcode secrets — use env vars. Integration configs stored in `integrations` table.
- Public absolute URLs (payment redirects, webhooks, admin links): use `getPublicSiteUrl()` from `lib/public-site-url.ts` (`NEXT_PUBLIC_APP_URL`, then legacy `NEXT_PUBLIC_SITE_URL`). Production CSP omits `unsafe-eval` (still allowed in development).

### Database
- All table types in `types/database.ts` — update this file when adding/modifying tables.
- RLS is the default; every table lives under a policy (see `docs/DATABASE.md`). Most user-facing tables are `service_role`-only; API routes use `createAdminSupabase()` as the single trusted path.
- Migrations are sequential under `supabase/migrations/`; never edit an applied migration in place — add a new one. Current tip: `20260418000005_fix_onconflict_constraint.sql`.
- Use `createServerSupabase()` for server components, `createBrowserSupabase()` for client, `createAdminSupabase()` for service-role ops.
- **Month lock** is enforced by DB trigger `check_month_lock` on `commission_sales` + `commission_sanctions`. To modify locked-month data, unlock temporarily via `commission_targets.is_locked` then re-lock — see `docs/private/RUNBOOK.md`.

### Integrations (`lib/integrations/`)
- Provider registry pattern: `hub.ts` manages providers by type (payment, email, sms, whatsapp).
- Payment gateway auto-detected by city: Israeli cities → Rivhit (iCredit), else → UPay.
- WhatsApp: YCloud API. SMS: Twilio. Email: SendGrid/Resend. AI: Anthropic Claude.
- Webhook verification: HMAC SHA256 via `lib/webhook-verify.ts` (constant-time comparison).

### i18n
- Bilingual: Hebrew + Arabic (RTL). DB columns use `*_ar` / `*_he` suffixes.
- UI translations in `locales/he.json` and `locales/ar.json`.
- Always provide both language variants for user-facing content.

### Components
- Store components: `components/store/` — ProductCard, SearchFilters, HeroCarousel, etc.
- Admin shell: `components/admin/AdminShell.tsx`. CRM shell: `components/crm/CRMShell.tsx`.
- Shared: `components/shared/` — Analytics, CookieConsent, LangSwitcher, Logo, Providers.
- Chat widget: `components/chat/WebChatWidget.tsx`.

## Key Domain Knowledge
- **Products**: type `device` or `accessory`; multi-storage variants with separate pricing; color system (hex + bilingual names); specs as JSONB.
- **Orders**: ID format `CLM-XXXXX`; statuses: new → approved → processing → shipped → delivered (or cancelled/rejected); sources: store/facebook/external/whatsapp/webchat/manual.
- **Customers**: segments: vip/loyal/active/new/cold/lost/inactive; loyalty program with points tiers (bronze/silver/gold/platinum).
- **Bot**: Multi-channel (webchat, WhatsApp, SMS); intent detection; AI-powered responses via Claude; handoff to human agents; 14 modules in `lib/bot/`.
- **Pipeline**: Sales stages: lead → negotiation → proposal → won/lost.
- **Commissions**: HOT Mobile dealer commission tracking. **Three sources unified** through a single entry point: `lib/commissions/register.ts::registerSaleCommission()` — used by Pipeline (deal → won stage), Sales PWA (agent direct submit, no manager approval), and hourly order sync (`.github/workflows/commission-sync.yml`). Conceptual docs: `docs/COMMISSIONS.md`. Actual rates: `docs/private/COMMISSION_RATES.md`. Sale types: `line` (package × configurable multiplier) and `device` (configurable base rate + **contract-wide** cumulative milestone bonus — attributed to whichever employee's sale crosses the threshold). `rate_snapshot JSONB` is pinned on every commission row so past profile edits never rewrite history. Month lock enforced by DB trigger `check_month_lock` on `commission_sales` + `commission_sanctions`. DB tables: `commission_sales`, `commission_targets`, `commission_sanctions`, `commission_employees`, `employee_commission_profiles`, `commission_sync_log`, `commission_correction_requests`.
- **Sales PWA (unified)**: Single employee app at `/sales-pwa/*` — dashboard with daily target pacing + daily-required amount (computed over Sun–Thu working days via `lib/commissions/date-utils.ts::countWorkingDays`), commissions ledger + Recharts 6-month chart, interactive calculator (no DB write), correction requests, activity log, broadcast announcements, documentation. Bottom nav on mobile, sidebar on desktop (`components/pwa/SalesPwaShell.tsx`). Offline via Service Worker + IndexedDB queue (`lib/pwa/offline-client.ts`). Flow: create draft → submit → atomic transition → `registerSaleCommission()` fires immediately (no manager approval, no file uploads as of 2026-04-18). Managers cancel via `/api/admin/sales-docs/[id]/cancel` — soft-deletes linked commissions, triggers month recalc. Details in `docs/PWA.md`.
- **Pipeline → commissions**: When a deal lands in a `pipeline_stages.is_won=true` stage for the first time (drag OR `convertPipelineDealToOrder`), `autoRegisterWonDealCommission()` creates a `sales_doc` + fires `registerSaleCommission()` with `source='pipeline'`. Idempotent via `idempotency_key = 'pipeline_<dealId>'`.
- **Announcements**: Admin broadcasts via `/admin/announcements` (priority + target audience + optional `expires_at`). Stored in `admin_announcements`; per-user read receipts in `admin_announcement_reads`. Surfaced in `/sales-pwa/announcements`.
- **Employee activity log**: Every commission event (registered, cancelled, sanction applied, target changed, milestone crossed, correction submitted/resolved) writes to `employee_activity_log` via `lib/employee/activity-log.ts`. Writes are non-throwing — activity logging never blocks a commission operation.
- **Categories**: Admin category management in `app/admin/categories/` + `app/api/admin/categories/`.

## Docs hierarchy
- Root `README.md` — overview, quick start, badges.
- Root `AGENTS.md` (this file) — agent/contributor guide.
- Root `PROJECT_MAP.md` — auto-generated directory inventory.
- Root `CHANGELOG.md` — Keep-a-Changelog format.
- `docs/` — canonical technical documentation (architecture, DB, API, commissions, PWA, bot, store, admin, CRM, testing, deployment, monitoring, i18n, security, contributing, incident-response, operations, RUM).
- `docs/private/` — gitignored; rates, business rules, runbook, infrastructure, onboarding, audit history.
- Before starting a new session, skim `PROJECT_MAP.md` for the current surface area.
