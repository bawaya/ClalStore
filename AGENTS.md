# Agent Guide — ClalMobile

> Canonical conventions for any AI agent (Claude, Copilot, Cursor) and any human contributor touching this codebase. Read this top-to-bottom once, then use it as lookup.

## Stack
Next.js 15 App Router · TypeScript (strict) · Tailwind CSS 3 · Supabase (Postgres + Auth + Storage) · Cloudflare Workers via OpenNext (edge) · Zod 4 validation · Zustand state · Vitest testing.

## Architecture

| Area | Path | Purpose |
|------|------|---------|
| **Public Store** | `app/store/` | E-commerce storefront (products, cart, checkout, wishlist, compare, tracking) |
| **Admin Panel** | `app/admin/` | Product/order/content management, analytics, bot config, push notifications, sales-docs |
| **CRM** | `app/crm/` | Inbox, customers, chats, orders, tasks, pipeline, reports, team users |
| **Sales PWA** | `app/sales-pwa/` | Field-sales mobile web app — documents → commissions |
| **Employee portal** | `app/employee/` | Self-service commissions view (read-only) |
| **API Routes** | `app/api/` | 129+ route handlers — see `docs/API-REFERENCE.md` |
| **Business Logic** | `lib/` | Domain logic: `lib/store/`, `lib/admin/`, `lib/crm/`, `lib/bot/`, `lib/ai/`, `lib/commissions/`, `lib/integrations/`, `lib/pwa/` |
| **Components** | `components/` | UI by domain: `store/`, `admin/`, `crm/`, `chat/`, `website/`, `shared/`, `ui/`, `pwa/` |
| **DB Types** | `types/database.ts` | 60+ table types — single source of truth for the Supabase schema |
| **Migrations** | `supabase/migrations/` | 50 SQL migrations — sequential, never edited in place |
| **i18n** | `locales/` | Hebrew (`he.json`) + Arabic (`ar.json`) — RTL bilingual UI |
| **Fonts** | `app/fonts.ts` | `next/font/google` (Heebo, Tajawal, David Libre) — applied on `<html>` in `app/layout.tsx` |
| **Public URL helper** | `lib/public-site-url.ts` | `getPublicSiteUrl()` for redirects, webhooks, admin links (not for PDF print popups — those may still load Google Fonts) |

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
- Supabase Auth for sessions; `users` table for roles/permissions.
- 6 roles: `super_admin` > `admin` > `sales` > `support` > `content` > `viewer`.
- Permission check: `hasPermission(user, 'orders')` / `canAccessPage(user, '/admin/products')`.
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
- **Commissions**: HOT Mobile dealer commission tracking. Single entry point: `lib/commissions/register.ts::registerSaleCommission()` — used by Pipeline (deal → won stage), Sales PWA (direct submit), and hourly order sync. Details in `docs/COMMISSIONS.md` (conceptual) and `docs/private/COMMISSION_RATES.md` (actual rates). Sale types: `line` (package × configurable multiplier), `device` (configurable base % + contract-wide milestone bonus). Rate snapshot (`rate_snapshot JSONB`) pins rates at sale time for historical accuracy. Nine sanction types (see private docs for amounts). Month lock via DB trigger. 6 DB tables: `commission_sales`, `commission_targets`, `commission_sanctions`, `commission_employees`, `employee_commission_profiles`, `commission_sync_log`.
- **Sales PWA**: Field agents document sales via `/sales-pwa/*`. Flow: create draft → upload attachments via signed URL (Storage bucket `sales-docs-private`) → submit → atomic transition → `registerSaleCommission()` fires immediately. No manager approval. Managers can cancel later via `/api/admin/sales-docs/[id]/cancel` — soft-deletes linked commissions and recalculates month. Details in `docs/PWA.md`.
- **Pipeline → commissions**: When a deal lands in a `pipeline_stages.is_won=true` stage for the first time (drag OR `convertPipelineDealToOrder`), `autoRegisterWonDealCommission()` creates a `sales_doc` + fires `registerSaleCommission()` with `source='pipeline'`. Idempotent via `idempotency_key = 'pipeline_<dealId>'`.
- **Categories**: Admin category management in `app/admin/categories/` + `app/api/admin/categories/`.

## Docs hierarchy
- Root `README.md` — overview, quick start, badges.
- Root `AGENTS.md` (this file) — agent/contributor guide.
- Root `PROJECT_MAP.md` — auto-generated directory inventory.
- Root `CHANGELOG.md` — Keep-a-Changelog format.
- `docs/` — canonical technical documentation (architecture, DB, API, commissions, PWA, bot, store, admin, CRM, testing, deployment, monitoring, i18n, security, contributing, incident-response, operations, RUM).
- `docs/private/` — gitignored; rates, business rules, runbook, infrastructure, onboarding, audit history.
- Before starting a new session, skim `PROJECT_MAP.md` for the current surface area.
