# Agent Guide — ClalMobile

## Stack
Next.js 14 App Router · TypeScript (strict) · Tailwind CSS 3 · Supabase (Postgres + Auth + Storage) · Cloudflare Pages (edge) · Zod 4 validation · Zustand state · Vitest testing.

## Architecture

| Area | Path | Purpose |
|------|------|---------|
| **Public Store** | `app/store/` | E-commerce storefront (products, cart, checkout, wishlist, compare, tracking) |
| **Admin Panel** | `app/admin/` | Product/order/content management, analytics, bot config, push notifications |
| **CRM** | `app/crm/` | Inbox, customers, chats, orders, tasks, pipeline, reports, team users |
| **API Routes** | `app/api/` | 99 route handlers — REST endpoints for all features |
| **Business Logic** | `lib/` | Domain logic: `lib/store/`, `lib/admin/`, `lib/crm/`, `lib/bot/`, `lib/ai/`, `lib/commissions/`, `lib/integrations/` |
| **Components** | `components/` | UI by domain: `store/`, `admin/`, `crm/`, `chat/`, `website/`, `shared/`, `ui/` |
| **DB Types** | `types/database.ts` | 35+ table types — single source of truth for the Supabase schema |
| **Migrations** | `supabase/migrations/` | 26 SQL migrations defining the full schema (001-026) |
| **i18n** | `locales/` | Hebrew (`he.json`) + Arabic (`ar.json`) — RTL bilingual UI |

## Build & Test
```
npm install              # Node >=18.17.0
npm run dev              # Dev server
npm run build            # Production build
npm run build:cf         # Cloudflare Pages build
npm run deploy:cf        # Build + deploy to CF Pages
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

### Database
- All table types in `types/database.ts` — update this file when adding/modifying tables.
- RLS policies enforced — service role for server operations, anon for public reads.
- Migrations are sequential: `001_initial_schema.sql` through `026_commissions_lock_and_analytics.sql`.
- Use `createServerSupabase()` for server components, `createBrowserSupabase()` for client, `createAdminSupabase()` for service-role ops.

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
- **Commissions**: HOT Mobile dealer commission tracking in `lib/commissions/` + `app/admin/commissions/` (6 sub-pages) + `app/api/admin/commissions/` (8 endpoints). Three revenue streams: line commissions (package×4), device commissions (5% + milestone bonuses per 50K), loyalty bonuses (at 5/9/12/15 months). 9 sanction types. Auto-sync from orders table. External bearer-token API for local HTML app. 4 DB tables: `commission_sales`, `commission_targets`, `commission_sanctions`, `commission_sync_log`.
- **Categories**: Admin category management in `app/admin/categories/` + `app/api/admin/categories/`.
