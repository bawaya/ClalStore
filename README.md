<div align="center">

# ClalMobile

**منصة التجارة الإلكترونية ونظام إدارة الأعمال المتكامل**

وكيل HOT Mobile المعتمد — متجر إلكتروني + لوحة إدارة + CRM + نظام عمولات + بوت ذكي

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

[![CI](https://img.shields.io/github/actions/workflow/status/bawaya/ClalStore/test.yml?branch=main&label=CI&logo=github)](https://github.com/bawaya/ClalStore/actions/workflows/test.yml)
[![Staging](https://img.shields.io/github/actions/workflow/status/bawaya/ClalStore/staging.yml?branch=main&label=Staging&logo=supabase)](https://github.com/bawaya/ClalStore/actions/workflows/staging.yml)
[![Smoke](https://img.shields.io/github/actions/workflow/status/bawaya/ClalStore/smoke.yml?branch=main&label=Smoke&logo=checkmarx)](https://github.com/bawaya/ClalStore/actions/workflows/smoke.yml)
[![Monitor](https://img.shields.io/github/actions/workflow/status/bawaya/ClalStore/monitor.yml?label=Monitor&logo=grafana)](https://github.com/bawaya/ClalStore/actions/workflows/monitor.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/bawaya/ClalStore/codeql.yml?branch=main&label=CodeQL&logo=github)](https://github.com/bawaya/ClalStore/actions/workflows/codeql.yml)
[![Status](https://img.shields.io/badge/status-live-brightgreen?logo=githubpages)](https://bawaya.github.io/ClalStore/)
[![License](https://img.shields.io/badge/license-proprietary-red)](#license)

**[🔴 Live status](https://bawaya.github.io/ClalStore/)** · **[📖 Documentation](./docs/README.md)** · **[🏗 Architecture](./docs/ARCHITECTURE.md)** · **[🧪 Testing](./docs/TESTING.md)** · **[🔒 Security](./docs/SECURITY.md)**

</div>

---

## Overview

ClalMobile is a full-stack bilingual (Arabic + Hebrew, RTL) e-commerce ecosystem built for a HOT Mobile authorized dealer. It combines a public storefront, admin panel, CRM, AI-powered chatbot, and dealer commission tracking into a single Next.js application deployed on Cloudflare Pages edge network.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 App Router |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS 3.4 |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth + 6-tier RBAC |
| **Storage** | Supabase Storage + Cloudflare R2 |
| **Hosting** | Cloudflare Pages (edge) |
| **Validation** | Zod 4 |
| **State** | Zustand |
| **AI** | Anthropic Claude + Google Gemini |
| **Payments** | Rivhit (iCredit) + UPay (auto-detected by city) |
| **Messaging** | YCloud (WhatsApp) + Twilio (SMS) + SendGrid/Resend (Email) |
| **Charts** | Recharts |
| **Testing** | Vitest |

## Quick Start

```bash
# Prerequisites: Node.js >=18.17.0

# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in Supabase URL, keys, and integration credentials

# 3. Run migrations (requires Supabase CLI)
npm run db:migrate

# 4. Start development server
npm run dev
# → http://localhost:3000
```

## Project Structure

```
clalmobile/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Homepage (landing page)
│   ├── layout.tsx                # Root layout (RTL, PWA, analytics)
│   ├── middleware.ts             # Auth, CSRF, rate limiting, CORS, security headers
│   │
│   ├── store/                    # 🛒 Public storefront
│   │   ├── page.tsx              #    Product catalog with search & filters
│   │   ├── product/[id]/         #    Product detail page
│   │   ├── cart/                 #    Shopping cart
│   │   ├── checkout/             #    Checkout flow
│   │   ├── wishlist/             #    Saved wishlist
│   │   ├── compare/              #    Product comparison
│   │   ├── account/              #    Customer account
│   │   └── track/                #    Order tracking
│   │
│   ├── admin/                    # 🔧 Admin dashboard (role-protected)
│   │   ├── page.tsx              #    Dashboard home
│   │   ├── products/             #    Product CRUD management
│   │   ├── categories/           #    Category management
│   │   ├── orders/               #    Order management
│   │   ├── commissions/          #    Commission tracking (6 sub-pages)
│   │   │   ├── page.tsx          #      Dashboard + pace tracking
│   │   │   ├── analytics/        #      Multi-month analytics
│   │   │   ├── team/             #      Team commission tracking
│   │   │   ├── sanctions/        #      Sanctions & deductions
│   │   │   ├── history/          #      Sales history
│   │   │   └── import/           #      Order sync / CSV import
│   │   ├── deals/                #    Flash deals & promotions
│   │   ├── heroes/               #    Hero carousel CMS
│   │   ├── homepage/             #    Homepage CMS editor
│   │   ├── lines/                #    HOT Mobile line plans
│   │   ├── prices/               #    Price configuration
│   │   ├── push/                 #    Push notifications
│   │   ├── reviews/              #    Review moderation
│   │   ├── bot/                  #    Chatbot configuration
│   │   ├── settings/             #    System settings
│   │   └── analytics/            #    Analytics dashboard
│   │
│   ├── crm/                      # 📋 CRM system (role-protected)
│   │   ├── page.tsx              #    CRM dashboard
│   │   ├── inbox/                #    Unified inbox (WhatsApp, WebChat, SMS)
│   │   ├── customers/            #    Customer list + 360° profiles
│   │   ├── orders/               #    CRM orders view
│   │   ├── pipeline/             #    Sales pipeline (lead → won/lost)
│   │   ├── tasks/                #    Task management
│   │   ├── users/                #    Team member management
│   │   └── reports/              #    CRM reports
│   │
│   ├── sales-pwa/                # 📱 Sales team PWA
│   ├── (auth)/login/             # 🔐 Team login
│   │
│   └── api/                      # 🔌 100+ REST API routes
│       ├── admin/                #    Admin APIs (~50 endpoints)
│       │   ├── products/         #      Product CRUD + bulk ops
│       │   ├── commissions/      #      Commission APIs (10 endpoints)
│       │   ├── categories/       #      Category CRUD
│       │   ├── orders/           #      Order management
│       │   └── ...               #      Settings, deals, push, AI, upload
│       ├── crm/                  #    CRM APIs (~20 endpoints)
│       ├── store/                #    Store APIs (search, autocomplete)
│       ├── orders/               #    Public order creation
│       ├── webhook/              #    WhatsApp + Twilio webhooks
│       ├── payment/              #    Payment gateway callbacks
│       ├── chat/                 #    WebChat API
│       ├── push/                 #    Push notification subscribe/VAPID
│       ├── cron/                 #    Scheduled jobs
│       └── health/               #    Health check
│
├── components/                   # UI Components
│   ├── admin/                    #    Admin shell, charts, modals
│   ├── store/                    #    ProductCard, SearchFilters, HeroCarousel, Cart
│   ├── crm/                      #    CRM shell, inbox (14+ components)
│   ├── chat/                     #    WebChat widget
│   ├── pwa/                      #    PWA components
│   ├── shared/                   #    Analytics, CookieConsent, LangSwitcher, Logo
│   ├── ui/                       #    Toast, shared UI primitives
│   └── website/                  #    Landing page components
│
├── lib/                          # Business Logic
│   ├── admin/                    #    Admin auth, validators, queries, AI tools
│   ├── ai/                       #    Anthropic Claude + Google Gemini
│   ├── bot/                      #    14-module chatbot engine
│   ├── commissions/              #    Calculator, sync, ledger, CRM bridge
│   ├── crm/                      #    Inbox, pipeline, queries, sentiment, realtime
│   ├── integrations/             #    Payment, email, SMS, WhatsApp providers
│   ├── orders/                   #    Order admin operations
│   ├── pwa/                      #    PWA utilities
│   ├── reports/                  #    Report generation
│   ├── store/                    #    Cart, wishlist, compare, queries
│   ├── api-response.ts           #    apiSuccess() / apiError() helpers
│   ├── supabase.ts               #    Supabase client factory
│   ├── auth.ts                   #    Session & auth utilities
│   ├── csrf.ts                   #    CSRF protection (double-submit)
│   ├── rate-limit.ts             #    Rate limiting
│   ├── webhook-verify.ts         #    HMAC SHA256 webhook verification
│   ├── i18n.tsx                  #    Internationalization (AR + HE, RTL)
│   ├── payment-gateway.ts        #    Payment routing (Rivhit/UPay)
│   └── validators.ts             #    Zod schemas
│
├── types/
│   └── database.ts               # 40+ Supabase table types (single source of truth)
│
├── supabase/
│   └── migrations/               # 42+ sequential SQL migrations
│
├── locales/
│   ├── ar.json                   # Arabic translations
│   └── he.json                   # Hebrew translations
│
├── public/                       # Static assets
│   ├── manifest.json             #    PWA manifest
│   ├── sw.js                     #    Service worker
│   └── icons/                    #    App icons
│
├── tests/
│   └── unit/                     # Vitest unit tests
│
├── middleware.ts                  # Edge middleware (auth, CSRF, CORS, rate limit, security)
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind design system
└── wrangler.json                 # Cloudflare Pages config
```

## Core Modules

### 🛒 Store (E-Commerce)
Full-featured storefront with product catalog, cart, checkout, wishlist, product comparison, order tracking, and customer accounts. Supports two product types: **devices** and **accessories** with multi-storage variants, color system (hex + bilingual names), and JSONB specs.

### 🔧 Admin Panel
15+ management pages covering products, categories, orders, deals, hero carousel, homepage CMS, line plans, pricing, push notifications, reviews, chatbot config, analytics dashboard, and system settings.

### 📋 CRM
Unified customer relationship management with multi-channel inbox (WhatsApp, WebChat, SMS), customer 360° profiles, sales pipeline (lead → negotiation → proposal → won/lost), task management, team management, and reports.

### 🤖 AI-Powered Chatbot
14-module bot engine supporting WebChat, WhatsApp, and SMS channels. Features intent detection, AI-powered responses (Claude), conversation playbooks, safety guardrails, and human agent handoff.

### 💰 Commission Tracking
HOT Mobile dealer commission calculator with three revenue streams:
- **Line commissions** — Package price × 4 multiplier
- **Device commissions** — 5% + milestone bonuses per 50K ILS
- **Loyalty bonuses** — At 5, 9, 12, 15 months (80+30+20+50 = 180 ILS/line)
- **9 sanction types** (1,000–2,500 ILS)
- Auto-sync from orders table + external bearer-token API

### 📱 Sales PWA
Progressive Web App for the sales team with offline-capable sales document management.

## Roles & Permissions (6-Tier RBAC)

| Role | Access Level |
|------|-------------|
| `super_admin` | Full system access |
| `admin` | Products, Orders, Customers, Settings, Commissions |
| `sales` | Orders, Customers, Pipeline, Tasks, Commissions |
| `support` | Orders, Customers, Tasks |
| `content` | Products, Heroes, Homepage CMS, Emails |
| `viewer` | Read-only Orders & Customers |

## Order System

**ID Format:** `CLM-XXXXX`

**Status Flow:**
```
new → approved → processing → shipped → delivered
         ↘ cancelled
         ↘ rejected
```

**Sources:** Store · Facebook · External · WhatsApp · WebChat · Manual

## Security

| Layer | Implementation |
|-------|---------------|
| **Authentication** | Supabase Auth sessions |
| **Authorization** | 6-tier RBAC with permission checks |
| **CSRF** | Double-submit cookie pattern |
| **Rate Limiting** | Per-route configurable limits |
| **Database** | Row-Level Security (RLS) policies |
| **Webhooks** | HMAC SHA256 constant-time verification |
| **CORS** | Restricted origins (webhook + commission APIs exempt) |
| **Headers** | X-Frame-Options, HSTS, CSP, XSS Protection |

## Integrations

| Service | Provider | Purpose |
|---------|---------|---------|
| **Payment (Israel)** | Rivhit (iCredit) | Auto-detected for Israeli cities |
| **Payment (Intl)** | UPay | Auto-detected for non-Israeli cities |
| **WhatsApp** | YCloud | Bot + inbox messaging |
| **SMS** | Twilio | Bot + notifications |
| **Email** | SendGrid / Resend | Transactional emails |
| **AI** | Anthropic Claude | Bot responses + content enhancement |
| **AI** | Google Gemini | Fallback AI + product autofill |
| **Image** | Remove.bg | Background removal |
| **Storage** | Cloudflare R2 | Static assets + cache |

## API Overview

| Category | Endpoints | Auth Method |
|----------|-----------|------------|
| Admin APIs | ~50 | Session (role-based) |
| Commission APIs | 10 | Session or Bearer token |
| CRM APIs | ~20 | Session |
| Store/Public APIs | ~20 | Public / customer token |
| Webhooks | 3 | HMAC / provider verification |
| **Total** | **100+** | Mixed |

## Scripts

```bash
npm run dev              # Development server
npm run build            # Next.js production build
npm run build:cf         # Cloudflare Pages build (OpenNext)
npm run deploy:cf        # Build + deploy to Cloudflare Pages
npm run lint             # ESLint
npm run format           # Prettier (write)
npm run format:check     # Prettier (check)
npm run test             # Vitest (watch mode)
npm run test:run         # Vitest (single run)
npm run test:coverage    # Coverage report
npm run db:migrate       # Push Supabase migrations
npm run db:seed          # Seed database
npm run db:reset         # Reset database
```

## Deployment

The application deploys to **Cloudflare Pages** using OpenNext adapter:

```bash
# Full deployment (3 steps required):
npm run build            # 1. Next.js build
npx opennextjs-cloudflare build  # 2. OpenNext adapter build
npx wrangler deploy      # 3. Deploy to Cloudflare Pages
```

## Database

**42+ sequential migrations** in `supabase/migrations/` covering:
- Core tables (products, orders, customers, users)
- Bot engine tables (conversations, messages, handoffs, analytics)
- CRM tables (inbox, pipeline, tasks)
- Commission tables (sales, targets, sanctions, profiles, employees)
- Feature tables (reviews, deals, coupons, loyalty, abandoned carts)
- Security (RLS policies, rate limits, RBAC permissions)
- Performance indexes

**Type definitions** in `types/database.ts` — single source of truth for all 40+ tables.

## i18n

Bilingual RTL support:
- **Arabic** (`locales/ar.json`) — Primary language
- **Hebrew** (`locales/he.json`) — Secondary language
- Database columns use `*_ar` / `*_he` suffixes
- Language switcher component in header

## Testing

Six-layer strategy — every code change passes through at least three of these before production.

| # | Layer | What it proves | Cadence |
|---|-------|----------------|---------|
| 1 | **Unit & Integration** (Vitest) | 2608 tests across 158 files, including coverage gates on critical files (`lib/admin/auth.ts` ≥ 98%, `lib/commissions/*` ≥ 95%) | Every commit |
| 2 | **CI** ([`test.yml`](.github/workflows/test.yml)) | TypeScript + ESLint + unit + build + Playwright (88 E2E) | Every PR |
| 3 | **Staging** ([`staging.yml`](.github/workflows/staging.yml)) | 37 tests against real Supabase with `TEST_` data · includes 17 RLS contract tests | Every push to main |
| 4 | **Production smoke** ([`smoke.yml`](.github/workflows/smoke.yml)) | 33 checks against `clalmobile.com` | Post-deploy + daily |
| 5 | **Hourly monitor** ([`monitor.yml`](.github/workflows/monitor.yml)) | 5 endpoints + SSL validity | Every hour |
| 6 | **Synthetic journeys** ([`synthetic.yml`](.github/workflows/synthetic.yml)) | 17 real user flows on production | Every 30 min |

Plus: CodeQL + gitleaks + `npm audit` (daily), Stryker mutation testing (weekly), visual regression + Lighthouse (PR-gated).

Complete guide: **[docs/TESTING.md](./docs/TESTING.md)**

## Security

- **RLS enforced** on every sensitive table. Policies are role-scoped, audited by 17 `tests/staging/rls-contract.test.ts` assertions that run on every push to `main`
- **Service-role-only writes** — all order / customer / commission mutations flow through `/api/*` routes; no direct writes from anon or authenticated clients
- **HMAC-verified webhooks** (WhatsApp, payments, Twilio) with constant-time comparison
- **CSRF** double-submit for every state-changing API
- **Rate limiting** on every route (`middleware.ts`)
- **CVE allowlist** with expiries — unknown HIGH/CRITICAL blocks CI

Full model + disclosure policy: **[docs/SECURITY.md](./docs/SECURITY.md)** · private reports → `security@clalmobile.com`

## Observability

- **Alert deduplication** — WhatsApp + email alerts route through [`alert-dedup.js`](./tests/monitor/alert-dedup.js), which uses GitHub Issues as the state store. First failure fires; subsequent failures append comments with a 2-hour cooldown; recovery auto-closes and notifies
- **Public status page** — [https://bawaya.github.io/ClalStore/](https://bawaya.github.io/ClalStore/) updated every 15 min
- **Real User Monitoring** plan — [docs/RUM-SETUP.md](./docs/RUM-SETUP.md) (Cloudflare Web Analytics + Sentry)

## Documentation

**[docs/README.md](./docs/README.md)** is the documentation hub.

| Document | When to read it |
|----------|-----------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Onboarding · system design · request flow |
| [docs/TESTING.md](./docs/TESTING.md) | Writing tests · running CI locally · debugging failures |
| [docs/SECURITY.md](./docs/SECURITY.md) | RLS design · auth · payments · secrets |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | Deploying · rolling back · rotating secrets · applying migrations |
| [docs/INCIDENT-RESPONSE.md](./docs/INCIDENT-RESPONSE.md) | When production breaks |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | Dev setup · PR process · code style |
| [CHANGELOG.md](./CHANGELOG.md) | What changed in each release |
| [AGENTS.md](./AGENTS.md) | Conventions for AI-assisted coding (Claude, Copilot) |

## License

Proprietary — All rights reserved.
