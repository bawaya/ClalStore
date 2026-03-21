# ClalMobile — Technical Documentation

> Full-stack e-commerce ecosystem & CRM platform for HOT Mobile authorized dealer (وكيل رسمي)
> Domain: clalmobile.com

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Authentication & Authorization](#authentication--authorization)
7. [Core Modules](#core-modules)
8. [Integrations](#integrations)
9. [Environment Variables](#environment-variables)
10. [Deployment](#deployment)
11. [Scripts & Commands](#scripts--commands)
12. [Design System](#design-system)
13. [Testing](#testing)
14. [Security Audit](#security-audit)

---

## Architecture Overview

ClalMobile is a monolithic Next.js 14 application using the App Router pattern, deployed on Cloudflare Pages (edge runtime). It combines three main subsystems:

```
┌─────────────────────────────────────────────────────┐
│                    ClalMobile                        │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Store    │  │  Admin   │  │      CRM         │  │
│  │ (Public)  │  │ (Panel)  │  │ (Sales/Support)  │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                  │            │
│       └──────────────┼──────────────────┘            │
│                      │                               │
│              ┌───────┴────────┐                      │
│              │  API Routes    │                      │
│              │  (84 endpoints)│                      │
│              └───────┬────────┘                      │
│                      │                               │
│  ┌───────────────────┼───────────────────────────┐  │
│  │           lib/ (Business Logic)                │  │
│  │  bot/ │ admin/ │ crm/ │ store/ │ integrations/ │  │
│  └───────────────────┬───────────────────────────┘  │
│                      │                               │
│  ┌───────────────────┼───────────────────────────┐  │
│  │           External Services                    │  │
│  │  Supabase │ yCloud │ Twilio │ Rivhit │ Claude  │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Data flow:** Browser → Next.js Middleware (auth/rate-limit/CSP) → API Route → lib/ logic → Supabase/External APIs → Response

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2 |
| Language | TypeScript | 5.5 |
| UI | React | 18.3 |
| Styling | Tailwind CSS | 3.4 |
| State | Zustand | 4.5 |
| Database | Supabase (PostgreSQL) | latest |
| Auth | Supabase Auth | SSR 0.5 |
| Storage | Supabase Storage + Cloudflare R2 | — |
| Hosting | Cloudflare Pages | — |
| AI | Anthropic Claude + OpenAI | — |
| Messaging | yCloud (WhatsApp) + Twilio (SMS) | — |
| Payment | Rivhit / iCredit / UPay | — |
| Email | Resend + SendGrid | — |
| Validation | Zod | 4.3 |
| Charts | Recharts | — |
| PDF | pdf-lib + pdfjs-dist | — |
| Analytics | Mixpanel | — |
| Icons | Lucide React | — |
| Testing | Vitest | 4.0 |

---

## Project Structure

```
clalmobile/
├── app/                            # Next.js 14 App Router
│   ├── layout.tsx                  # Root layout + providers
│   ├── page.tsx                    # Homepage (landing)
│   ├── loading.tsx                 # Global loading spinner
│   ├── not-found.tsx               # 404 page
│   ├── error.tsx                   # Error boundary
│   ├── global-error.tsx            # Global error boundary
│   ├── sitemap.ts                  # Dynamic sitemap
│   ├── robots.ts                   # Robots.txt
│   ├── icon.tsx                    # Dynamic favicon
│   ├── apple-icon.tsx              # Apple touch icon
│   │
│   ├── (auth)/login/               # Team login page
│   ├── (public)/                   # Public pages (about, FAQ, legal, contact, deals)
│   │
│   ├── store/                      # E-commerce storefront
│   │   ├── page.tsx                # Product catalog
│   │   ├── product/[id]/           # Product detail
│   │   ├── cart/                   # Shopping cart
│   │   ├── checkout/               # Checkout flow
│   │   ├── account/                # Customer account
│   │   ├── auth/                   # Customer auth
│   │   ├── compare/                # Product comparison
│   │   ├── wishlist/               # Wishlist
│   │   ├── track/                  # Order tracking (public)
│   │   └── contact/                # Contact form
│   │
│   ├── admin/                      # Admin dashboard (protected)
│   │   ├── page.tsx                # Dashboard overview
│   │   ├── layout.tsx              # Admin layout (sidebar)
│   │   ├── products/               # Product CRUD
│   │   ├── order/                  # Order management
│   │   ├── analytics/              # Sales analytics
│   │   ├── prices/                 # Pricing management
│   │   ├── heroes/                 # Hero banners
│   │   ├── coupons/                # Discount codes
│   │   ├── deals/                  # Flash deals
│   │   ├── lines/                  # Prepaid plans
│   │   ├── reviews/                # Review management
│   │   ├── push/                   # Push notifications
│   │   ├── bot/                    # Bot management
│   │   ├── settings/               # Store settings
│   │   ├── features/               # Feature flags
│   │   ├── homepage/               # Homepage CMS
│   │   └── website/                # Website content CMS
│   │
│   ├── crm/                        # CRM system (protected)
│   │   ├── page.tsx                # CRM dashboard
│   │   ├── layout.tsx              # CRM layout
│   │   ├── orders/                 # Order pipeline
│   │   ├── customers/              # Customer database
│   │   ├── inbox/                  # WhatsApp inbox
│   │   ├── chats/                  # Bot chat monitoring
│   │   ├── pipeline/               # Sales pipeline (kanban)
│   │   ├── reports/                # CRM reports
│   │   └── users/                  # Team management
│   │
│   └── api/                        # 84 API routes
│       ├── admin/                  # Admin endpoints (protected)
│       ├── crm/                    # CRM endpoints (protected)
│       ├── store/                  # Public store APIs
│       ├── orders/                 # Order creation
│       ├── auth/                   # Customer auth
│       ├── webhook/                # WhatsApp + Twilio webhooks
│       ├── payment/                # Payment gateways
│       ├── email/                  # Email sending
│       ├── push/                   # Push notifications
│       ├── notifications/          # Notification management
│       ├── contact/                # Contact form
│       ├── chat/                   # WebChat API
│       ├── reviews/                # Review submission
│       ├── coupons/                # Coupon validation
│       ├── customer/               # Customer profile/loyalty
│       ├── reports/                # Cron reports
│       ├── cron/                   # Scheduled tasks
│       ├── health/                 # Health check
│       └── settings/               # Public settings
│
├── components/                     # React components
│   ├── ui/                         # Base UI (Button, Card, Badge, Input, etc.)
│   ├── shared/                     # Reusable shared components
│   ├── store/                      # Store-specific components
│   ├── admin/                      # Admin components
│   │   └── charts/                 # Recharts visualizations
│   ├── crm/                        # CRM components
│   │   └── inbox/                  # Inbox UI
│   ├── chat/                       # WebChat widget
│   └── website/                    # Landing page sections
│
├── lib/                            # Business logic & utilities
│   ├── supabase.ts                 # Supabase clients (browser/server/admin)
│   ├── auth.ts                     # Auth utilities
│   ├── constants.ts                # Business constants (statuses, roles, banks, cities)
│   ├── validators.ts               # Israeli validators (ID, Luhn, phone)
│   ├── utils.ts                    # Formatting & helpers
│   ├── hooks.ts                    # React hooks (useScreen, useToast, useDebounce)
│   ├── storage.ts                  # File storage
│   ├── storage-r2.ts               # Cloudflare R2 storage
│   ├── rate-limit.ts               # Rate limiting
│   ├── payment-gateway.ts          # Payment routing
│   ├── loyalty.ts                  # Loyalty points system
│   ├── notifications.ts            # Push notifications
│   ├── notify.ts                   # Admin WhatsApp notifications
│   ├── email-templates.ts          # Email HTML templates
│   ├── seo.ts                      # SEO utilities
│   ├── analytics-events.ts         # Mixpanel events
│   │
│   ├── admin/                      # Admin-specific logic
│   │   ├── queries.ts              # Admin CRUD operations
│   │   ├── auth.ts                 # Admin auth checks
│   │   ├── validators.ts           # Admin input validation
│   │   ├── hooks.ts                # Admin React hooks
│   │   ├── ai-tools.ts             # AI product enhancement
│   │   ├── gsmarena.ts             # GSMArena device specs
│   │   └── mobileapi.ts            # MobileAPI device database
│   │
│   ├── bot/                        # WhatsApp bot engine
│   │   ├── engine.ts               # Main state machine
│   │   ├── intents.ts              # Intent detection (NLU)
│   │   ├── playbook.ts             # Conversation flows
│   │   ├── policies.ts             # Policy responses
│   │   ├── templates.ts            # Message templates
│   │   ├── whatsapp.ts             # yCloud integration
│   │   ├── webchat.ts              # WebChat integration
│   │   ├── ai.ts                   # Claude/OpenAI fallback
│   │   ├── guardrails.ts           # Safety & rate limiting
│   │   ├── handoff.ts              # Human handoff
│   │   ├── admin-notify.ts         # Admin notifications
│   │   ├── analytics.ts            # Conversation analytics
│   │   └── notifications.ts        # Escalation alerts
│   │
│   ├── crm/                        # CRM logic
│   │   ├── queries.ts              # CRM data queries
│   │   ├── inbox.ts                # Inbox operations
│   │   ├── inbox-types.ts          # Type definitions
│   │   └── sentiment.ts            # Sentiment analysis
│   │
│   ├── store/                      # Store logic
│   │   ├── queries.ts              # Product/order queries
│   │   ├── cart.ts                 # Cart management
│   │   ├── wishlist.ts             # Wishlist
│   │   └── compare.ts              # Product comparison
│   │
│   ├── integrations/               # External service providers
│   │   ├── hub.ts                  # Provider registry
│   │   ├── resend.ts               # Email (Resend)
│   │   ├── sendgrid.ts             # Email (SendGrid)
│   │   ├── rivhit.ts               # Payment gateway
│   │   ├── upay.ts                 # Payment gateway
│   │   ├── ycloud-wa.ts            # WhatsApp API
│   │   ├── ycloud-templates.ts     # WhatsApp templates
│   │   ├── twilio-sms.ts           # SMS/OTP
│   │   └── removebg.ts             # Image background removal
│   │
│   ├── ai/                         # AI utilities
│   │   ├── claude.ts               # Anthropic Claude client
│   │   ├── product-context.ts      # Product AI context
│   │   └── usage-tracker.ts        # Token usage tracking
│   │
│   └── reports/                    # Report generation
│       └── service.ts              # PDF report service
│
├── types/
│   └── database.ts                 # Full TypeScript types
│
├── styles/
│   └── globals.css                 # Tailwind + design tokens
│
├── public/                         # Static assets
│   ├── icons/                      # App icons
│   ├── images/                     # Static images
│   └── manifest.json               # PWA manifest
│
├── supabase/
│   ├── migrations/                 # 20 SQL migration files
│   └── seed/                       # Seed data scripts
│
├── tests/
│   ├── setup.ts                    # Vitest setup
│   └── unit/                       # Unit tests
│
├── middleware.ts                    # Auth + security + CORS + rate limiting
├── next.config.js                   # Next.js configuration
├── tailwind.config.ts               # Tailwind configuration
├── tsconfig.json                    # TypeScript configuration
├── vitest.config.ts                 # Test configuration
├── wrangler.json                    # Cloudflare Pages config
├── .eslintrc.json                   # ESLint rules
├── .env.example                     # Environment template
├── CLAUDE.md                        # AI assistant context
├── README.md                        # Quick start guide
├── LAUNCH.md                        # Deployment guide
└── DOCS.md                          # This file
```

---

## Database Schema

### Core Tables (30+)

#### Users & Auth
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Team members | id, email, name, role, phone, active |
| `customers` | Store shoppers | id, name, email, phone, segment, loyalty_points |

#### Products & Catalog
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Device/accessory catalog | id, name_ar, brand, price, cost, stock, image_url, specs |
| `product_variants` | Size/color options | id, product_id, color, storage, price, stock |
| `categories` | Collections | id, name, type (manual/auto), filter_rules |
| `product_reviews` | Customer reviews | id, product_id, customer_name, rating, comment |

#### Orders & Commerce
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `orders` | Purchase orders | id, order_number (CLM-XXXXX), customer_*, status, total, source |
| `order_items` | Line items | id, order_id, product_id, variant_id, quantity, price |
| `order_notes` | Internal notes | id, order_id, user_id, note, type |
| `coupons` | Discount codes | id, code, type (percentage/fixed), value, min_order, usage_limit |

#### CRM & Communication
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `inbox_conversations` | Chat threads | id, customer_phone, channel, status, assigned_to, sentiment |
| `inbox_messages` | Messages | id, conversation_id, direction, content, media_url |
| `inbox_labels` | Tags | id, name, color |
| `inbox_notes` | Internal notes | id, conversation_id, user_id, content |
| `tasks` | Team tasks | id, title, assigned_to, status, due_date |
| `pipeline_deals` | Sales pipeline | id, customer_id, stage, value, probability |

#### Bot System
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `bot_conversations` | Bot sessions | id, phone, session_data, status |
| `bot_messages` | Bot messages | id, conversation_id, role, content |
| `bot_templates` | WhatsApp templates | id, name, language, components, status |
| `bot_analytics` | Performance metrics | id, metric_type, value, date |

#### Content & Settings
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `heroes` | Homepage banners | id, title, subtitle, image_url, link, active |
| `deals` | Flash promotions | id, product_id, discount, starts_at, ends_at |
| `line_plans` | Prepaid plans | id, name, data_gb, minutes, price, provider |
| `website_content` | CMS pages | id, section, key, value_ar, value_he |
| `settings` | Store config | id, key, value, category |
| `integrations` | Service configs | id, provider, config, active |
| `email_templates` | Email campaigns | id, name, subject, body, variables |

#### Notifications & Analytics
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `push_subscriptions` | Web push | id, endpoint, keys, user_agent |
| `push_notifications` | Notification queue | id, title, body, sent_at, clicks |
| `loyalty_points` | Rewards | id, customer_id, points, tier |
| `loyalty_transactions` | Points history | id, customer_id, amount, type, order_id |
| `abandoned_carts` | Recovery | id, customer_id, items, recovered |
| `audit_log` | Compliance | id, user_id, action, entity, entity_id, details |

### Order Status Flow

```
جديد (new) → موافق (approved) → قيد الشحن (shipping) → تم التسليم (delivered)
                ↘ مرفوض (rejected)
                ↘ لا يوجد رد 1 → لا يوجد رد 2 → لا يوجد رد 3
```

---

## API Reference

### Admin APIs (`/api/admin/*`) — Protected, role-based

#### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/products` | Create product |
| PUT | `/api/admin/products/:id` | Update product |
| DELETE | `/api/admin/products/:id` | Delete product |
| POST | `/api/admin/products/autofill` | AI auto-fill device specs |
| POST | `/api/admin/products/color-image` | AI image background removal |
| POST | `/api/admin/products/bulk-color-images` | Bulk image processing |
| POST | `/api/admin/products/pexels` | Search Pexels for images |
| POST | `/api/admin/products/distribute-stock` | Allocate stock across variants |

#### Pricing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/prices/apply` | Apply bulk pricing rules |
| POST | `/api/admin/prices/match` | Match competitor prices |

#### Content Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/heroes` | Manage homepage banners |
| POST | `/api/admin/deals` | Create flash deals |
| POST | `/api/admin/lines` | Manage prepaid plans |
| POST | `/api/admin/coupons` | Manage discount codes |
| POST | `/api/admin/reviews/generate` | Generate review cards |

#### Analytics & AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/analytics/dashboard` | Dashboard metrics |
| POST | `/api/admin/analytics` | Custom reports |
| POST | `/api/admin/ai-enhance` | AI product enhancement |
| POST | `/api/admin/ai-usage` | Track AI token usage |
| POST | `/api/admin/features/stats` | Feature analytics |

#### Files & Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/upload` | Upload file to R2 |
| POST | `/api/admin/image-enhance` | AI image processing |
| POST | `/api/admin/integrations/test` | Test integration setup |
| GET/POST | `/api/admin/settings` | Store settings |

### CRM APIs (`/api/crm/*`) — Protected

#### Inbox
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/inbox` | List conversations |
| GET | `/api/crm/inbox/:id` | Get conversation details |
| POST | `/api/crm/inbox/:id/send` | Send WhatsApp message |
| POST | `/api/crm/inbox/:id/status` | Change conversation status |
| POST | `/api/crm/inbox/:id/assign` | Assign agent |
| POST | `/api/crm/inbox/:id/notes` | Add internal note |
| POST | `/api/crm/inbox/:id/sentiment` | Analyze sentiment |
| POST | `/api/crm/inbox/:id/suggest` | AI response suggestions |
| POST | `/api/crm/inbox/:id/summary` | AI conversation summary |
| POST | `/api/crm/inbox/:id/auto-label` | Auto-tag conversation |
| POST | `/api/crm/inbox/:id/recommend` | AI product recommendation |
| GET | `/api/crm/inbox/labels` | Label management |
| GET | `/api/crm/inbox/stats` | Inbox analytics |
| POST | `/api/crm/inbox/upload` | Media upload |

#### Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/orders` | Order list |
| GET | `/api/crm/customers` | Customer database |
| POST | `/api/crm/pipeline` | Sales pipeline deals |
| POST | `/api/crm/tasks` | Task management |
| GET | `/api/crm/reports` | CRM reports |
| GET | `/api/crm/users` | Team members |
| GET | `/api/crm/chats/:id` | Chat thread |
| GET | `/api/crm/dashboard` | CRM dashboard |

### Public APIs

#### Store
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/store` | Product listing (with filters) |
| GET | `/api/store/order-status` | Track order (public) |
| GET | `/api/store/autocomplete` | Search suggestions |
| POST | `/api/store/smart-search` | AI-powered search |

#### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Customer registration |
| POST | `/api/auth/login` | Customer login |
| POST | `/api/auth/customer` | Customer profile |

#### Payment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment` | Create payment session |
| GET | `/api/payment/callback` | Rivhit/iCredit callback |
| POST | `/api/payment/upay/callback` | UPay callback |

#### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhook/whatsapp` | yCloud WhatsApp messages |
| POST | `/api/webhook/twilio` | Twilio SMS/OTP |

#### Other Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order |
| POST | `/api/contact` | Contact form |
| POST | `/api/chat` | WebChat messages |
| POST | `/api/reviews` | Submit review |
| POST | `/api/reviews/featured` | Featured reviews |
| POST | `/api/coupons/validate` | Validate coupon |
| POST | `/api/push/subscribe` | Register push subscription |
| POST | `/api/push/send` | Send push notification |
| POST | `/api/email` | Send email |
| POST | `/api/email/campaign` | Email campaign |
| POST | `/api/customer/profile` | Customer profile |
| POST | `/api/customer/orders` | Customer orders |
| POST | `/api/customer/loyalty` | Loyalty points |
| GET | `/api/settings/public` | Public store settings |
| GET | `/api/health` | System health check |
| POST | `/api/reports/daily` | Daily cron report |
| POST | `/api/reports/weekly` | Weekly cron report |

---

## Authentication & Authorization

### Auth Providers
- **Team auth:** Supabase Auth (email/password)
- **Customer auth:** Token-based with session storage

### Role-Based Access Control

```typescript
type Role = 'super_admin' | 'admin' | 'sales' | 'support' | 'content' | 'viewer';
```

| Role | Products | Orders | Customers | Settings | Pipeline | Bot |
|------|----------|--------|-----------|----------|----------|-----|
| super_admin | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD |
| admin | CRUD | CRUD | CRUD | CRUD | — | View |
| sales | View | CRUD | CRUD | — | CRUD | — |
| support | View | Edit | Edit | — | — | — |
| content | CRUD | — | — | — | — | — |
| viewer | View | View | View | — | — | — |

### Middleware Protection

```
Protected routes:  /admin/*, /crm/*, /login
Protected APIs:    /api/admin/*, /api/crm/*
Public routes:     /store/*, /(public)/*, /
Public APIs:       /api/store/*, /api/webhook/*, /api/health
```

### Rate Limiting
- Login: 5 attempts/minute
- Webhooks: 100 requests/minute
- Contact form: 3 submissions/minute
- Chat: 20 messages/minute

---

## Core Modules

### 1. E-Commerce Store (`app/store/`, `lib/store/`)
- Product catalog with filters (brand, category, price range)
- Product variants (colors, storage sizes)
- Shopping cart with Zustand state + localStorage persistence
- Wishlist management
- Product comparison (up to 4 products)
- Coupon validation at checkout
- Multiple payment gateways (Rivhit, iCredit, UPay)
- Public order tracking via order number
- Customer reviews with ratings

### 2. WhatsApp Bot (`lib/bot/`)
Intent-based conversational engine with state machine:

```
User Message → Intent Detection → Playbook Router → Response
                                       ↓
                              [product_search, order_status,
                               prepaid_plans, installment_calc,
                               store_info, human_handoff]
                                       ↓
                              AI Fallback (Claude) if no match
```

Features:
- Product search & recommendations
- Order status lookup
- Prepaid plan information
- Installment calculator
- Human agent handoff
- Sentiment analysis
- Guardrails (rate limiting, blocked patterns, content safety)
- Admin notifications for escalations
- CSAT tracking

### 3. Admin Dashboard (`app/admin/`, `lib/admin/`)
- Product CRUD with AI-assisted spec filling (GSMArena, MobileAPI)
- Bulk pricing tools (competitor matching, margin rules)
- Automated image processing (RemoveBG, Pexels search)
- Stock distribution across variants
- Order management with status workflow
- Customer analytics with Recharts
- Hero banner management
- Coupon & deal creation
- Team settings & role management
- Website CMS

### 4. CRM System (`app/crm/`, `lib/crm/`)
- WhatsApp inbox with real-time message management
- Conversation assignment & status tracking
- AI features: sentiment analysis, response suggestions, summaries, auto-labeling
- Sales pipeline (kanban-style deal tracking)
- Task management
- Customer database with segmentation
- PDF reports (daily/weekly) via cron

### 5. Loyalty System (`lib/loyalty.ts`)
- Points accumulation per purchase
- Tier-based rewards
- Point redemption at checkout
- Transaction history

### 6. Notifications (`lib/notifications.ts`, `lib/notify.ts`)
- Web Push (VAPID)
- WhatsApp notifications via yCloud
- Email campaigns (Resend/SendGrid)
- SMS/OTP (Twilio)
- In-app toasts (Sonner)

---

## Integrations

| Service | Purpose | Config File | Key Env Vars |
|---------|---------|-------------|-------------|
| **Supabase** | Database, Auth, Storage | `lib/supabase.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **yCloud** | WhatsApp messaging | `lib/integrations/ycloud-wa.ts` | `YCLOUD_API_KEY`, `WHATSAPP_PHONE_ID` |
| **Twilio** | SMS / OTP | `lib/integrations/twilio-sms.ts` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| **Rivhit/iCredit** | Payment processing | `lib/integrations/rivhit.ts` | `ICREDIT_GROUP_PRIVATE_TOKEN` |
| **UPay** | Alternative payment | `lib/integrations/upay.ts` | (configured in integration settings) |
| **Resend** | Email delivery | `lib/integrations/resend.ts` | `RESEND_API_KEY` |
| **SendGrid** | Email (fallback) | `lib/integrations/sendgrid.ts` | `SENDGRID_API_KEY` |
| **Anthropic Claude** | AI bot, CRM AI | `lib/ai/claude.ts` | `ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY_BOT` |
| **OpenAI** | Product descriptions | `lib/admin/ai-tools.ts` | `OPENAI_API_KEY` |
| **Cloudflare R2** | Image storage | `lib/storage-r2.ts` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` |
| **Pexels** | Stock images | Admin AI tools | `PEXELS_API_KEY` |
| **RemoveBG** | Image processing | `lib/integrations/removebg.ts` | `REMOVEBG_API_KEY` |
| **GSMArena** | Device specs | `lib/admin/gsmarena.ts` | — (scraping) |
| **MobileAPI** | Device database | `lib/admin/mobileapi.ts` | `MOBILEAPI_KEY` |
| **Mixpanel** | Analytics | `lib/analytics-events.ts` | `NEXT_PUBLIC_MIXPANEL_TOKEN` |

---

## Environment Variables

### Critical (Required)
```env
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key (server-only)
NEXT_PUBLIC_APP_URL=              # App URL (https://clalmobile.com)
```

### Payment
```env
ICREDIT_GROUP_PRIVATE_TOKEN=      # iCredit payment token
ICREDIT_TEST_MODE=                # "true" for sandbox
```

### WhatsApp (yCloud)
```env
YCLOUD_API_KEY=                   # yCloud API key
WHATSAPP_PHONE_ID=                # WhatsApp business phone ID
WEBHOOK_VERIFY_TOKEN=             # Webhook verification token
```

### SMS (Twilio)
```env
TWILIO_ACCOUNT_SID=               # Twilio account SID
TWILIO_AUTH_TOKEN=                 # Twilio auth token
TWILIO_VERIFY_SERVICE_SID=        # OTP verification service
TWILIO_MESSAGING_SERVICE_SID=     # Messaging service
TWILIO_FROM_NUMBER=               # Sender phone number
```

### Email
```env
RESEND_API_KEY=                   # Resend API key
RESEND_FROM=                      # Sender email
SENDGRID_API_KEY=                 # SendGrid API key
SENDGRID_FROM=                    # SendGrid sender email
```

### AI
```env
ANTHROPIC_API_KEY=                # Claude (general)
ANTHROPIC_API_KEY_BOT=            # Claude (bot-specific)
ANTHROPIC_API_KEY_ADMIN=          # Claude (admin features)
ANTHROPIC_API_KEY_STORE=          # Claude (store search)
OPENAI_API_KEY=                   # OpenAI (product descriptions)
OPENAI_API_KEY_ADMIN=             # OpenAI (admin features)
```

### Storage (Cloudflare R2)
```env
R2_ACCOUNT_ID=                    # Cloudflare account ID
R2_ACCESS_KEY_ID=                 # R2 access key
R2_SECRET_ACCESS_KEY=             # R2 secret key
R2_BUCKET_NAME=                   # R2 bucket name
R2_PUBLIC_URL=                    # R2 public URL
```

### Push Notifications
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=     # VAPID public key
VAPID_PRIVATE_KEY=                # VAPID private key
```

### Other
```env
REMOVEBG_API_KEY=                 # RemoveBG API key
MOBILEAPI_KEY=                    # MobileAPI key
PEXELS_API_KEY=                   # Pexels API key
TEAM_WHATSAPP_NUMBERS=            # Admin notification phones (comma-separated)
ADMIN_REPORT_PHONE=               # Report recipient phone
ADMIN_PERSONAL_PHONE=             # Admin personal phone
CRON_SECRET=                      # Cron job authentication
NEXT_PUBLIC_MIXPANEL_TOKEN=       # Mixpanel analytics token
```

---

## Deployment

### Cloudflare Pages

**Build command:**
```bash
npx @cloudflare/next-on-pages
```

**Output directory:**
```
.vercel/output/static
```

**Steps:**
1. Connect repo to Cloudflare Pages
2. Set build command and output directory
3. Add all environment variables in Cloudflare Dashboard
4. Connect domain: `clalmobile.com`
5. Set up webhook URLs for yCloud and Twilio

### Webhook URLs (Production)
```
WhatsApp: https://clalmobile.com/api/webhook/whatsapp
Twilio:   https://clalmobile.com/api/webhook/twilio
Payment:  https://clalmobile.com/api/payment/callback
UPay:     https://clalmobile.com/api/payment/upay/callback
```

---

## Scripts & Commands

### Development
```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint check
npm run format           # Prettier formatting
```

### Cloudflare
```bash
npm run build:cf         # Build for Cloudflare Pages
npm run preview:cf       # Local Cloudflare preview
npm run deploy:cf        # Deploy to Cloudflare Pages
```

### Database
```bash
npm run db:migrate       # Run Supabase migrations
npm run db:seed          # Seed initial data
npm run db:reset         # Reset database (dev only!)
```

### Testing
```bash
npm run test             # Run Vitest (watch mode)
npm run test:run         # Single test run
npm run test:coverage    # Coverage report (HTML)
```

---

## Design System

### Colors
```css
--brand:       #E11D48 (Rose/Red - primary)
--surface:     Dynamic light/dark backgrounds
--state-*:     Success (green), Warning (amber), Error (red), Info (blue)
```

### Typography
- **Arabic:** Tajawal (Google Fonts)
- **Hebrew:** David Libre, Heebo (Google Fonts)
- **English:** System fonts

### RTL Support
- Full RTL layout for Arabic and Hebrew
- `dir="rtl"` on root layout
- Tailwind RTL utilities

### Responsive Breakpoints
| Name | Width | Usage |
|------|-------|-------|
| mobile | < 640px | Phone layouts |
| tablet | 640-1024px | Tablet layouts |
| desktop | > 1024px | Full layouts |

---

## Testing

- **Framework:** Vitest 4.0
- **Environment:** jsdom
- **Location:** `tests/unit/`
- **Setup:** `tests/setup.ts`
- **Coverage:** HTML reporter

```bash
npm run test           # Watch mode
npm run test:run       # CI mode
npm run test:coverage  # With coverage
```

---

## Security Audit

### Critical Issues Found

| # | Issue | Severity | Location | Recommendation |
|---|-------|----------|----------|----------------|
| 1 | Hardcoded fallback cron secret | HIGH | `api/cron/reports/route.ts:79` | Remove default value, require env var |
| 2 | Hardcoded MobileAPI key fallback | HIGH | `lib/admin/mobileapi.ts:9` | Remove default value |
| 3 | CSP allows `unsafe-inline` + `unsafe-eval` | MEDIUM | `middleware.ts:88-91` | Use nonces or hashes instead |
| 4 | Timing-vulnerable token comparison | MEDIUM | `api/webhook/whatsapp/route.ts:20` | Use `crypto.timingSafeEqual()` |
| 5 | Regex-based HTML sanitization | MEDIUM | `api/reviews/route.ts:88` | Use `sanitize-html` or `DOMPurify` |
| 6 | Minimal customer token validation | LOW | `api/customer/orders/route.ts:11` | Add proper JWT/token type verification |

### Code Quality Issues

| # | Issue | Severity | Count | Recommendation |
|---|-------|----------|-------|----------------|
| 1 | `console.log` in production code | MEDIUM | 7+ files | Remove or replace with structured logging |
| 2 | Excessive `any` type usage | MEDIUM | 10+ files | Enable `@typescript-eslint/no-explicit-any` |
| 3 | ESLint rules disabled | LOW | `.eslintrc.json` | Re-enable `no-unused-vars`, `no-explicit-any` |
| 4 | Missing `React.memo()` on components | LOW | Multiple | Add memoization for expensive components |
| 5 | `@next/next/no-img-element` disabled | LOW | `.eslintrc.json` | Use Next.js `Image` component |
| 6 | N+1 query pattern in webhook | LOW | `webhook/whatsapp/route.ts:48` | Use `.or()` filter instead of loop |
| 7 | No centralized error tracking | LOW | Global | Add Sentry or similar service |

### Recommendations Priority

**Immediate (before launch):**
1. Remove all hardcoded secret fallbacks
2. Remove `console.log` from production API routes
3. Implement constant-time token comparison for webhooks

**Short-term:**
4. Replace regex HTML sanitization with proper library
5. Tighten CSP headers (remove `unsafe-eval`)
6. Add centralized error tracking (Sentry)
7. Re-enable stricter ESLint rules

**Long-term:**
8. Eliminate `any` types across codebase
9. Add comprehensive API request validation with Zod schemas
10. Use Next.js `Image` component for optimization
11. Add env var validation at startup
12. Increase test coverage

---

*Last updated: 2026-03-20*
*Generated from comprehensive codebase analysis*
