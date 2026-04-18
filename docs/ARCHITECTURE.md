# Architecture

> System architecture, data flow, and design decisions for the ClalMobile stack.

## Table of Contents

- [High-level topology](#high-level-topology)
- [Runtime stack](#runtime-stack)
- [Application layout](#application-layout)
- [Data model](#data-model)
- [Integration Hub](#integration-hub)
- [Rendering & caching](#rendering--caching)
- [Bilingual + RTL](#bilingual--rtl)
- [Responsiveness](#responsiveness)
- [Key design decisions](#key-design-decisions)

---

## High-level topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER BROWSER                                │
│   Storefront · Cart · Compare · Wishlist · Customer account (i18n/RTL)   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKER (edge, global)                       │
│                    Next.js 15 App Router (via OpenNext)                   │
│                                                                           │
│   ┌──────────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│   │ Server Components │  │ API Routes  │  │ Middleware (auth, CSRF,   │  │
│   │  (Storefront,     │  │  /api/*     │  │  rate-limit, CORS, lang)  │  │
│   │   Admin, CRM)     │  │  (100+)     │  │                            │  │
│   └─────────┬────────┘  └──────┬───────┘  └───────────────────────────┘  │
└─────────────┼──────────────────┼──────────────────────────────────────────┘
              │                   │
       Service role             Admin / Anon keys
              │                   │
              ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   SUPABASE (PostgreSQL + Auth + Storage)                  │
│                                                                           │
│   PostgreSQL 17 · RLS on every sensitive table · 42+ migrations          │
│   Auth · Storage (products bucket) · Realtime (inbox)                     │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         │ Auxiliary services (all via lib/integrations/*)
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  yCloud (WhatsApp)    Twilio (SMS)    Rivhit + UPay (payment)            │
│  SendGrid / Resend    Anthropic Claude    Google Gemini    OpenAI        │
│  Cloudflare R2 (storage)    Pexels + RemoveBG (images)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Runtime stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Edge runtime** | Cloudflare Workers (via OpenNext) | Global low-latency + generous free tier + no cold starts for the app we serve |
| **Framework** | Next.js 15 App Router | Server Components default, file-based routing, built-in image optimization (disabled on CF), middleware |
| **Language** | TypeScript `strict: true` | Non-negotiable — every refactor benefits |
| **Styling** | Tailwind CSS 3.4 + custom theme | Fast authorial iteration, theme tokens map 1:1 to design |
| **State** | Zustand (client) | Simple, no context boilerplate, persist middleware built in |
| **Schema validation** | Zod 4 | Used at every API boundary |
| **Database** | Supabase (Postgres 17 + PostgREST + Auth + Storage) | Single vendor for DB/auth/storage keeps ops simple; RLS gives us per-row auth |
| **Object storage** | Cloudflare R2 (primary) + Supabase Storage (fallback) | R2 is cheaper at scale; fallback ensures uploads work if R2 is unreachable |
| **Charts** | Recharts | Tree-shakeable, React-native components |
| **Testing** | Vitest + Playwright + Stryker + axe-core | See [TESTING.md](./TESTING.md) |

---

## Application layout

```
app/
├── layout.tsx                  # Root — fonts, i18n, PWA manifest, analytics
├── middleware.ts               # Auth, CSRF, rate limit, CORS, security headers
├── page.tsx                    # Landing page (Server Component)
│
├── store/                      # 🛒 Public storefront (anon or customer-auth)
│   ├── page.tsx                #   Product catalog
│   ├── product/[id]/           #   Product detail
│   ├── cart/                   #   Cart (client — Zustand)
│   ├── checkout/               #   Checkout flow (success/failed pages)
│   ├── wishlist/               #   Zustand persist
│   ├── compare/                #   Zustand persist
│   ├── account/                #   Customer profile (after OTP login)
│   └── track/                  #   Order tracking (no login)
│
├── admin/                      # 🔧 Admin (requireAdmin + role gates)
│   ├── page.tsx                #   Dashboard
│   ├── products/               #   Product CRUD
│   ├── orders/                 #   Order pipeline
│   ├── commissions/            #   Sales team commission tracking
│   ├── heroes/                 #   Homepage carousel CMS
│   ├── deals/, reviews/, ...   #   Content management
│   └── settings/, integrations/#   System config
│
├── crm/                        # 📋 Staff CRM (requireAdmin + role)
│   ├── inbox/                  #   Unified WhatsApp + WebChat
│   ├── customers/              #   360° customer view
│   ├── pipeline/               #   Lead → won/lost kanban
│   ├── tasks/                  #   Follow-up tasks
│   └── reports/                #   Daily/weekly reports
│
├── sales-pwa/                  # 📱 Offline-capable PWA for field sales
│
├── (auth)/login/               # 🔐 Admin/staff login (Supabase Auth)
├── change-password/
│
└── api/                        # 🔌 Next.js route handlers (100+)
    ├── admin/*                 #   50+ admin endpoints (role-gated)
    ├── crm/*                   #   20+ CRM endpoints
    ├── store/*                 #   autocomplete, smart-search, order-status
    ├── orders/                 #   POST: public order creation
    ├── customer/*              #   profile, orders, loyalty
    ├── auth/                   #   customer OTP + password change
    ├── payment/                #   create + callback endpoints
    ├── webhook/                #   WhatsApp + Twilio inbound
    ├── cron/                   #   Cloudflare-triggered jobs (gated by CRON_SECRET)
    ├── push/                   #   Web Push subscription + send
    ├── notifications/          #   In-app notifications CRUD
    ├── reports/                #   Daily + weekly report generation
    ├── health/                 #   Monitoring endpoint
    └── csrf/                   #   Token issuance

components/                     # React UI components
├── store/                      #   Storefront pieces
├── admin/                      #   Admin shell + shared widgets
├── crm/inbox/                  #   Unified inbox UI
├── mobile/                     #   Mobile-first variants
├── shared/                     #   Navbar, Footer, LangSwitcher, Logo, PWA prompt
└── ui/                         #   Generic primitives (Toast, Modal, etc.)

lib/                            # Business logic (not routed)
├── admin/                      #   auth, queries, validators, ai-tools
├── bot/                        #   Engine, intents, guardrails, playbook, webchat, whatsapp
├── commissions/                #   Calculator, ledger, sync-orders, crm-bridge
├── crm/                        #   Inbox, pipeline, queries, sentiment, realtime, timeline
├── integrations/               #   Hub + provider implementations
├── pwa/                        #   Sales PWA auth + customer linking
├── store/                      #   Cart, wishlist, compare, queries (Zustand)
├── ai/                         #   Claude, Gemini, OpenAI clients
├── reports/                    #   Report HTML + PDF generation
├── orders/admin.ts             #   Manual order creation
├── webhook-verify.ts           #   Signature verification (HMAC-SHA1/256)
├── csrf.ts / csrf-client.ts    #   Token generation + validation
├── rate-limit.ts / rate-limit-db.ts
├── loyalty.ts                  #   Points, tiers, transactions
├── supabase.ts                 #   Client factories (browser / server / admin)
├── api-response.ts             #   apiSuccess / apiError helpers
└── validators.ts, utils.ts, i18n.tsx, ...

supabase/migrations/            # 42+ sequential .sql migrations
types/database.ts               # Single-source-of-truth for every table shape
tests/                          # Six-layer test suite — see TESTING.md
```

---

## Data model

### Tables by domain (~60)

| Domain | Core tables |
|--------|-------------|
| **Products** | `products`, `product_reviews`, `categories`, `deals`, `heroes`, `line_plans` |
| **Orders** | `orders`, `order_items`, `order_notes`, `order_status_history`, `abandoned_carts` |
| **Customers** | `customers`, `customer_notes`, `customer_hot_accounts`, `customer_otps` |
| **Team & RBAC** | `users`, `permissions`, `role_permissions`, `audit_log` |
| **CRM / Inbox** | `inbox_conversations`, `inbox_messages`, `inbox_labels`, `inbox_notes`, `inbox_templates`, `inbox_quick_replies`, `pipeline_stages`, `pipeline_deals`, `tasks` |
| **Bot** | `bot_conversations`, `bot_messages`, `bot_handoffs`, `bot_policies`, `bot_templates`, `bot_analytics` |
| **Commissions** | `commission_sales`, `commission_targets`, `commission_sanctions`, `commission_sync_log`, `commission_employees`, `employee_commission_profiles` |
| **Engagement** | `push_subscriptions`, `push_notifications`, `notifications`, `loyalty_points`, `loyalty_transactions` |
| **Integrations** | `integrations` (key-value config per provider) |
| **Content** | `sub_pages`, `website_content`, `email_templates`, `settings` |
| **Sales docs (PWA)** | `sales_docs`, `sales_doc_items`, `sales_doc_attachments`, `sales_doc_events`, `sales_doc_sync_queue` |

Every table has a corresponding `Row` / `Insert` / `Update` type in `types/database.ts`. This file is the **single source of truth** — adding a column means updating it here first.

### Bilingual columns

Content tables use `*_ar` / `*_he` suffix pairs (e.g., `products.name_ar`, `products.name_he`). The `getProductName(p, lang)` helper picks the right one and falls back to Arabic.

### RLS

See [SECURITY.md → RLS](./SECURITY.md#row-level-security-rls-on-supabase).

---

## Integration Hub

`lib/integrations/hub.ts` implements a provider registry for 6 categories:

| Category | Interface | Providers |
|----------|-----------|-----------|
| Payment | `PaymentProvider` | Rivhit (iCredit), UPay |
| Email | `EmailProvider` | SendGrid, Resend |
| SMS | `SMSProvider` | Twilio |
| WhatsApp | `WhatsAppProvider` | yCloud |
| Shipping | `ShippingProvider` | *(slot, not wired)* |
| Storage | *(direct call, not HOF)* | Supabase Storage, Cloudflare R2 |

### Runtime behavior

1. On first use, `getProvider(type)` calls `initializeProviders()` which reads the `integrations` table
2. For each active config, a provider class is instantiated (e.g., `new RivhitProvider()`)
3. The provider is cached in-memory; `registerProvider()` allows hot-swap for tests

This means the admin can swap providers (e.g., SendGrid → Resend) via the `integrations` table without code changes.

---

## Rendering & caching

| Page pattern | Rendering | Cache |
|--------------|-----------|-------|
| `app/page.tsx` (home) | Server Component | ISR — `revalidate: 3600` |
| `app/store/page.tsx` | Server Component | ISR — `revalidate: 3600` |
| `app/store/product/[id]` | Server Component | Dynamic — revalidated on product mutation |
| `app/admin/**`, `app/crm/**` | Client (most) with `"use client"` | No cache — auth-gated |
| `app/api/**` | Node route handler | Varies (most dynamic) |

Cloudflare Workers handles edge caching of static assets; dynamic routes hit the Worker directly.

---

## Bilingual + RTL

- `lib/i18n.tsx` provides `<LangProvider>` + `useLang()` hook returning `{ lang, setLang, t, dir: "rtl", fontClass }`
- Language preference persists to `localStorage` under `clal_lang`
- Arabic is the default; Hebrew is the secondary switch
- All JSX trees use `dir="rtl"` on the root; Tailwind's logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) are preferred over physical (`ml-*`, `pr-*`)
- `ar.json` and `he.json` keys are kept in sync by a test in `tests/i18n/translations.test.ts`

---

## Responsiveness

Every page renders on **mobile, tablet, and desktop**. The `useScreen()` hook (in `lib/hooks.ts`) returns `{ mobile, tablet, desktop, width }` and is the canonical way to branch layout — no raw media queries in components.

Patterns:
- Admin/CRM: sidebar on desktop, bottom-tab nav on mobile (e.g., `components/admin/AdminShell.tsx`)
- Storefront: grid density shifts (4 cols desktop → 2 cols mobile)
- Inbox: 3-pane on desktop (list + chat + contact panel), single pane with navigation on mobile (`app/m/inbox/`)

---

## Key design decisions

### Why Cloudflare Workers, not Vercel?

Cost at scale + global edge for Israeli traffic routing. OpenNext adapter is mature enough to run Next.js 15 App Router seamlessly.

### Why Zustand, not Redux/Jotai/Context?

Three stores total (`cart`, `wishlist`, `compare`) — Redux is overkill, context adds prop-drilling. Zustand's `persist` middleware ships localStorage out of the box.

### Why mock Supabase in CI instead of using Supabase CLI locally?

CLI requires Docker and 2 min of bootstrap per test run. A 100-line mock HTTP server (`tests/ci/mock-supabase.mjs`) answers enough of the PostgREST shape that Server Components render empty-state UI. Real Supabase behavior is tested in Layer 3 (staging) where it matters.

### Why FORCE RLS on only 2 tables instead of all?

FORCE applies even to `BYPASSRLS` roles, which breaks Postgres's internal FK validation on tables that are FK targets (when the FK check needs to SELECT the referenced row). We keep FORCE on `sub_pages` and `audit_log` (no FK-inbound writes) and rely on standard `ENABLE RLS` + service-role-only policies elsewhere.

### Why `sb_secret_` keys, not JWT `service_role`?

Supabase's newer key format; simpler to rotate and doesn't require decoding. The `@supabase/supabase-js@2.100+` client handles both.

### Why self-host the status page on GitHub Pages?

Zero cost, zero maintenance, strong uptime independence from the thing being monitored (i.e., Cloudflare could go down while GitHub Pages remains up, and vice versa). The status page pulls `status.json` + `history.json` committed by the `publish-status.yml` workflow.

---

## Reference diagrams

### Request flow — product detail page

```
Browser GET /store/product/abc123
   │
   ▼
Cloudflare Worker (edge)
   │  middleware.ts: attach lang cookie, rate limit, CSRF (read-only → skip)
   ▼
app/store/product/[id]/page.tsx (Server Component)
   │  uses getProduct(id) via createServerSupabase() (anon key)
   ▼
Supabase PostgREST → RLS: products.active = true public-read policy → data
   ▼
Server Component returns HTML with ProductDetail component
   │
   ▼
Browser hydrates client portions (add-to-cart button, gallery)
```

### Request flow — checkout

```
Browser POST /api/orders
  body: { items, shipping, customer }
   │
   ▼
Cloudflare Worker
   │  middleware.ts: CSRF check on x-csrf-token header
   │  rate limit: 60 req/min/IP
   ▼
app/api/orders/route.ts
   │  validate with Zod
   │  createAdminSupabase() (service role) → insert into `orders`, `order_items`
   │  trigger commission sync via syncCommissionForOrder()
   ▼
Return order id + payment redirect URL
   │
   ▼
Browser redirects to Rivhit / UPay
   │
   ▼
Provider callback → app/api/payment/callback/route.ts
   │  verify HMAC signature
   │  update order status
   │  send WhatsApp order-confirmation
   ▼
Customer sees /store/checkout/success
```

### Request flow — WhatsApp inbound message

```
Customer → yCloud
   │
   ▼
yCloud POST /api/webhook/whatsapp (signed)
   │
   ▼
app/api/webhook/whatsapp/route.ts
   │  verify HMAC-SHA256 signature
   │  parse incoming message
   ▼
lib/bot/engine.ts → processMessage()
   │  detect intent, apply guardrails
   │  if handoff: write to inbox_conversations
   │  else: generate bot reply via Claude
   ▼
Reply sent via yCloud
   │
   ▼
inbox_messages row inserted (+ realtime event to CRM tab)
```
