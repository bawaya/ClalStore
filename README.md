# ClalMobile — E-Commerce Ecosystem

> HOT Mobile authorized dealer — full-stack e-commerce, CRM, and commission management platform

## Tech Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage + Cloudflare R2
- **Hosting:** Cloudflare Pages (edge runtime)
- **AI:** Anthropic Claude + Google Gemini (dynamic switching)
- **Domain:** clalmobile.com

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run all migrations in `supabase/migrations/` (001 through 026)
3. Copy your project URL and keys

### 3. Environment variables
```bash
cp .env.example .env.local
# Fill in your Supabase credentials
```

### 4. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
clalmobile/
├── app/
│   ├── store/              → Public e-commerce storefront
│   ├── admin/              → Admin dashboard (protected)
│   │   ├── products/       → Product CRUD
│   │   ├── categories/     → Category management
│   │   ├── commissions/    → Commission Calculator module
│   │   │   ├── page.tsx        → Dashboard (overview + pace tracking)
│   │   │   ├── calculator/     → Calculator (5 tabs)
│   │   │   ├── sanctions/      → Sanctions management
│   │   │   ├── history/        → Sales history
│   │   │   ├── import/         → Order sync / CSV import
│   │   │   └── analytics/      → Multi-month analytics
│   │   └── ...             → Other admin pages (14 total)
│   ├── crm/                → CRM system (protected)
│   ├── (auth)/login/       → Team login
│   └── api/                → 99 API routes
│       ├── admin/commissions/  → 8 commission endpoints
│       └── ...
├── components/
│   ├── ui/                 → Shared UI (Button, Card, Badge...)
│   ├── admin/              → Admin components
│   ├── store/              → Store components
│   └── crm/                → CRM components
├── lib/
│   ├── commissions/        → Commission calculation engine
│   │   ├── calculator.ts   → Formulas (line, device, loyalty, target)
│   │   └── sync-orders.ts  → Auto-sync orders to commission_sales
│   ├── admin/              → Admin logic
│   ├── crm/                → CRM logic
│   ├── bot/                → WhatsApp bot engine
│   ├── ai/                 → AI utilities (Claude / Gemini)
│   ├── integrations/       → External services (payment, email, SMS)
│   └── ...                 → Supabase, auth, hooks, validators
├── types/
│   └── database.ts         → TypeScript types (35+ tables)
├── supabase/
│   └── migrations/         → 26 SQL migrations (001-026)
└── middleware.ts            → Auth, CSRF, rate limiting, CORS
```

## Core Modules

| Module | Path | Description |
|--------|------|-------------|
| **Store** | `app/store/` | Product catalog, cart, checkout, wishlist, compare, tracking |
| **Admin** | `app/admin/` | 14 admin pages: products, categories, commissions, analytics, etc. |
| **CRM** | `app/crm/` | Inbox, customers, pipeline, tasks, reports, team |
| **Bot** | `lib/bot/` | WhatsApp + WebChat bot with AI fallback |
| **Commissions** | `lib/commissions/` + `app/admin/commissions/` | HOT Mobile commission calculator with 6 sub-pages |

## Commission Calculator Module

Contract-based commission tracking for HOT Mobile dealer:

- **Line commissions:** Package price x4 multiplier (min 19.90 ILS)
- **Device commissions:** 5% of net device sales + milestone bonuses (2,500 ILS per 50,000 ILS)
- **Loyalty bonuses:** Earned at 5, 9, 12, and 15 months (80+30+20+50 = 180 ILS total per line)
- **Sanctions:** 9 predefined penalty types (1,000-2,500 ILS)
- **Auto-sync:** Syncs completed orders from the store to commission tracking
- **External API:** Bearer token authenticated endpoint for local HTML app sync

Admin pages: Dashboard, Calculator (5 tabs), Sanctions, History, Import/Sync, Analytics

## Roles & Permissions

| Role | Access |
|------|--------|
| super_admin | Everything |
| admin | Products, Orders, Customers, Settings, Commissions |
| sales | Orders, Customers, Pipeline, Tasks |
| support | Orders, Customers, Tasks |
| content | Products, Heroes, Emails |
| viewer | Read-only Orders & Customers |

## Order Statuses

```
new → approved → shipping → delivered
        ↘ rejected
        ↘ no_answer_1 → no_answer_2 → no_answer_3
```

## Order Sources
Store | Facebook | External | WhatsApp | WebChat | Manual

## API Highlights

| Category | Count | Auth |
|----------|-------|------|
| Admin APIs | ~40 | Session (role-based) |
| CRM APIs | ~25 | Session |
| Commission APIs | 8 | Session or Bearer token |
| Store/Public APIs | ~26 | Public or customer token |
| Total | 99 | Mixed |

### Commission API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/commissions/dashboard` | Session or Bearer | Full dashboard with pace tracking |
| GET | `/api/admin/commissions/summary` | Bearer only | Lightweight summary for local app |
| GET/POST | `/api/admin/commissions/sales` | Session | CRUD sales records |
| POST | `/api/admin/commissions/calculate` | Session | Calculate line/device/loyalty/target |
| GET/POST | `/api/admin/commissions/sanctions` | Session | CRUD sanctions |
| GET/POST | `/api/admin/commissions/sync` | Session | Auto-sync orders |
| GET/POST | `/api/admin/commissions/targets` | Session | Monthly targets |
| GET | `/api/admin/commissions/analytics` | Session | Multi-month analytics |
| GET | `/api/admin/commissions/export` | Session | CSV export |

## Deployment

```bash
npm run build:cf        # Build for Cloudflare Pages
npm run deploy:cf       # Deploy
```

See [LAUNCH.md](./LAUNCH.md) for full deployment guide.
See [DOCS.md](./DOCS.md) for comprehensive technical documentation.
