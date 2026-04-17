# ClalMobile — Technical Documentation

> Full-stack bilingual (Arabic + Hebrew, RTL) e-commerce ecosystem for HOT Mobile authorized dealer.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Middleware & Security](#7-middleware--security)
8. [Core Modules](#8-core-modules)
9. [Commission System](#9-commission-system)
10. [Bot Engine](#10-bot-engine)
11. [Integrations](#11-integrations)
12. [Internationalization](#12-internationalization)
13. [Design System](#13-design-system)
14. [Environment Variables](#14-environment-variables)
15. [Deployment](#15-deployment)
16. [Testing](#16-testing)

---

## 1. Architecture Overview

ClalMobile is a monolithic Next.js 15 application using the App Router, deployed on Cloudflare Pages edge network. It combines five subsystems:

```
┌───────────────────────────────────────────────────────────────┐
│                         ClalMobile                            │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────┐  │
│  │  Store    │  │  Admin   │  │   CRM   │  │  Sales PWA   │  │
│  │ (Public)  │  │ (Panel)  │  │ (Inbox) │  │  (Mobile)    │  │
│  └────┬─────┘  └────┬─────┘  └────┬────┘  └──────┬───────┘  │
│       └──────────────┼─────────────┼──────────────┘          │
│                      │                                        │
│              ┌───────┴────────┐                               │
│              │   API Routes   │                               │
│              │ (100+ endpoints)│                               │
│              └───────┬────────┘                               │
│                      │                                        │
│  ┌───────────────────┼────────────────────────────────────┐  │
│  │              lib/ (Business Logic)                      │  │
│  │  bot/ │ admin/ │ crm/ │ store/ │ commissions/ │ pwa/   │  │
│  └───────────────────┬────────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────┼────────────────────────────────────┐  │
│  │              External Services                          │  │
│  │  Supabase │ YCloud │ Twilio │ Rivhit │ UPay │ Claude   │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

**Request Flow:**
```
Browser → Cloudflare Edge → Next.js Middleware → API Route Handler → lib/ Business Logic → Supabase / External API → JSON Response
                              (auth, CSRF, rate       (Zod validation,    (calculator, sync,
                               limit, CORS,            requireAdmin,       queries, integrations)
                               security headers)       apiSuccess/apiError)
```

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js (App Router) | 15 | SSR + API routes |
| **Language** | TypeScript | 5.5 | Strict mode enabled |
| **UI** | React | 18.3 | Component library |
| **Styling** | Tailwind CSS | 3.4 | Utility-first CSS |
| **State** | Zustand | 4.5 | Client-side state |
| **Database** | Supabase (PostgreSQL) | latest | Data + Auth + Storage |
| **Auth** | Supabase Auth SSR | 0.5 | Session management |
| **Hosting** | Cloudflare Pages | — | Edge deployment |
| **Adapter** | OpenNext Cloudflare | 1.18 | Next.js → CF Workers |
| **Validation** | Zod | 4.3 | Input validation |
| **AI** | Anthropic Claude | — | Bot + content enhancement |
| **AI** | Google Gemini | — | Fallback + autofill |
| **WhatsApp** | YCloud | — | Bot + inbox |
| **SMS** | Twilio | — | Bot + notifications |
| **Email** | SendGrid / Resend | — | Transactional emails |
| **Payment** | Rivhit (iCredit) | — | Israeli payment gateway |
| **Payment** | UPay | — | International gateway |
| **Charts** | Recharts | 3.8 | Admin analytics |
| **PDF** | pdf-lib + pdfjs-dist | — | Invoice/export |
| **Excel** | xlsx (SheetJS) | 0.18 | Data export |
| **Icons** | Lucide React | 0.400 | Icon library |
| **Testing** | Vitest | 4.0 | Unit testing |
| **Storage** | Cloudflare R2 | — | Static assets + cache |

---

## 3. Project Structure

### Pages (`app/`)

#### Public Store (`app/store/`)
| Route | Page | Description |
|-------|------|-------------|
| `/store` | `page.tsx` | Product catalog with search, filters, categories |
| `/store/product/[id]` | `page.tsx` | Product detail (gallery, specs, variants, reviews) |
| `/store/cart` | `page.tsx` | Shopping cart with quantity management |
| `/store/checkout` | `page.tsx` | Multi-step checkout + payment |
| `/store/wishlist` | `page.tsx` | Saved wishlist |
| `/store/compare` | `page.tsx` | Side-by-side product comparison |
| `/store/account` | `page.tsx` | Customer profile & order history |
| `/store/track` | `page.tsx` | Order tracking by ID |

#### Admin Panel (`app/admin/`)
| Route | Page | Description |
|-------|------|-------------|
| `/admin` | `page.tsx` | Dashboard home (stats, recent orders, alerts) |
| `/admin/products` | `page.tsx` | Product CRUD (create, edit, delete, bulk ops) |
| `/admin/categories` | `page.tsx` | Category management (auto/manual rules) |
| `/admin/orders` | `page.tsx` | Order management + status pipeline |
| `/admin/commissions` | `page.tsx` | Commission dashboard + pace tracking |
| `/admin/commissions/analytics` | `page.tsx` | Multi-month commission analytics |
| `/admin/commissions/team` | `page.tsx` | Team commission tracking |
| `/admin/commissions/sanctions` | `page.tsx` | Sanctions & deduction management |
| `/admin/commissions/history` | `page.tsx` | Sales history records |
| `/admin/commissions/import` | `page.tsx` | Order sync / CSV bulk import |
| `/admin/deals` | `page.tsx` | Flash deals & promotions |
| `/admin/heroes` | `page.tsx` | Hero carousel CMS |
| `/admin/homepage` | `page.tsx` | Homepage CMS editor (sections) |
| `/admin/lines` | `page.tsx` | HOT Mobile line plans management |
| `/admin/prices` | `page.tsx` | Price configuration |
| `/admin/push` | `page.tsx` | Push notification management |
| `/admin/reviews` | `page.tsx` | Review moderation (approve/reject) |
| `/admin/bot` | `page.tsx` | Chatbot configuration |
| `/admin/settings` | `page.tsx` | System settings |
| `/admin/analytics` | `page.tsx` | Analytics dashboard |

#### CRM (`app/crm/`)
| Route | Page | Description |
|-------|------|-------------|
| `/crm` | `page.tsx` | CRM dashboard (conversations, tasks, pipeline) |
| `/crm/inbox` | `page.tsx` | Unified inbox (WhatsApp, WebChat, SMS) |
| `/crm/chats` | `page.tsx` | Chat history management |
| `/crm/customers` | `page.tsx` | Customer database |
| `/crm/customers/[id]` | `page.tsx` | Customer 360° profile |
| `/crm/orders` | `page.tsx` | CRM orders view |
| `/crm/pipeline` | `page.tsx` | Sales pipeline (lead → won/lost) |
| `/crm/tasks` | `page.tsx` | Task management |
| `/crm/users` | `page.tsx` | Team member management |
| `/crm/reports` | `page.tsx` | CRM reports & analytics |

#### Other Routes
| Route | Description |
|-------|-------------|
| `/` | Homepage (landing, featured products, CMS) |
| `/login` | Team staff login |
| `/change-password` | Password change |
| `/sales-pwa` | Sales team PWA |
| `/deals` | Public deals page |
| `/about`, `/faq`, `/contact` | Info pages |
| `/legal`, `/privacy` | Legal pages |
| `/command-center` | Admin command center |

### Business Logic (`lib/`)

| Module | Files | Description |
|--------|-------|-------------|
| `lib/admin/` | auth, validators, queries, hooks, ai-tools, device-data, gsmarena, mobileapi | Admin operations, auth (`requireAdmin()`), Zod validators |
| `lib/ai/` | — | AI service abstraction (Claude + Gemini) |
| `lib/bot/` | engine, ai, intents, playbook, guardrails, handoff, templates, policies, notifications, admin-notify, analytics, webchat, whatsapp | 14-module chatbot engine |
| `lib/commissions/` | calculator, sync-orders, ledger, crm-bridge | Commission calculation + order sync |
| `lib/crm/` | queries, inbox, inbox-types, pipeline, realtime, sentiment | CRM data layer + realtime |
| `lib/integrations/` | hub, rivhit, upay, ycloud-wa, ycloud-templates, twilio-sms, sendgrid, resend, removebg | Provider registry pattern |
| `lib/orders/` | admin | Order management operations |
| `lib/pwa/` | — | PWA service utilities |
| `lib/reports/` | — | Report generation |
| `lib/store/` | cart, wishlist, compare, queries | Store state + queries |

#### Key Root-Level Libraries

| File | Purpose |
|------|---------|
| `lib/api-response.ts` | `apiSuccess(data)` / `apiError(msg, status)` — standardized API responses |
| `lib/supabase.ts` | `createServerSupabase()`, `createBrowserSupabase()`, `createAdminSupabase()` |
| `lib/auth.ts` | Session management, `getSession()`, `getUser()` |
| `lib/csrf.ts` | Server-side CSRF token validation (double-submit cookie) |
| `lib/csrf-client.ts` | Client-side CSRF token fetch |
| `lib/rate-limit.ts` | In-memory rate limiting |
| `lib/rate-limit-db.ts` | Database-backed rate limiting |
| `lib/webhook-verify.ts` | HMAC SHA256 webhook verification (constant-time) |
| `lib/payment-gateway.ts` | Payment routing — Israeli cities → Rivhit, else → UPay |
| `lib/i18n.tsx` | Internationalization (Arabic + Hebrew) |
| `lib/validators.ts` | Shared Zod schemas |
| `lib/constants.ts` | Global constants |
| `lib/hooks.ts` | React hooks (`useMediaQuery`, `useLocalStorage`, etc.) |
| `lib/loyalty.ts` | Loyalty program logic (tiers, points) |
| `lib/notifications.ts` | Notification system |
| `lib/email-templates.ts` | Email template engine |
| `lib/seo.ts` | SEO utilities & metadata |
| `lib/pdf-export.ts` | PDF generation |
| `lib/storage.ts` | Supabase Storage helpers |
| `lib/storage-r2.ts` | Cloudflare R2 integration |
| `lib/cities.ts` | Israeli cities list (for payment routing) |
| `lib/crypto.ts` | Encryption utilities |
| `lib/analytics-events.ts` | Analytics event tracking |

### Components (`components/`)

| Directory | Key Components | Description |
|-----------|---------------|-------------|
| `components/admin/` | AdminShell, ImageUpload, charts/ | Admin layout shell + admin-specific UI |
| `components/store/` | ProductCard, ProductDetail, SearchFilters, SmartSearchBar, HeroCarousel, StoreHeader, StoreClient, LinePlans, LoyaltyWidget, ReviewsSection, StickyCartBar, FloatingActions, CompareBar, cart/ | Full storefront UI |
| `components/crm/` | CRMShell, OrdersManagementPage, inbox/ (14+ components: InboxLayout, ChatPanel, MessageBubble, ConversationList, AssignAgent, QuickReplies, TemplateSelector...) | CRM layout + inbox system |
| `components/chat/` | WebChatWidget | Embedded chat widget |
| `components/pwa/` | — | PWA-specific components |
| `components/shared/` | Analytics, CookieConsent, LangSwitcher, Logo, Providers, PWAInstallPrompt | Cross-cutting shared UI |
| `components/ui/` | Toast | Base UI primitives |
| `components/website/` | — | Landing page components |
| `components/mobile/` | — | Mobile-optimized components |
| `components/orders/` | — | Order display components |
| `components/command-center/` | — | Command center UI |

---

## 4. Database Schema

**Source of truth:** `types/database.ts` (40+ table types)
**Migrations:** `supabase/migrations/` (39 sequential SQL files)

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `products` | Product catalog | `id`, `type` (device/accessory), `name_ar`, `name_he`, `price`, `stock`, `gallery`, `colors` (JSONB), `storage_options`, `variants`, `specs` (JSONB) |
| `orders` | Customer orders | `id` (CLM-XXXXX), `customer_id`, `status`, `source`, `items_total`, `total`, `payment_method`, `shipping_city`, `assigned_to` |
| `order_items` | Order line items | `order_id`, `product_id`, `product_name`, `price`, `quantity`, `color`, `storage` |
| `order_notes` | Internal order notes | `order_id`, `user_id`, `text` |
| `order_status_history` | Order audit trail | `order_id`, `old_status`, `new_status`, `changed_by_id` |
| `customers` | Customer profiles | `name`, `phone`, `email`, `city`, `segment`, `loyalty_tier`, `tags` |
| `customer_notes` | Customer notes | `customer_id`, `user_id`, `text` |
| `users` | Staff accounts | `auth_id`, `name`, `email`, `role` (6 roles), `status`, `last_login_at` |
| `categories` | Product categories | `name_ar`, `name_he`, `type` (auto/manual), `rule`/`product_ids`, `sort_order` |
| `settings` | System settings | `key`, `value`, `type` (string/number/boolean/json) |
| `integrations` | Integration configs | `type`, `provider`, `config` (JSONB), `status` |

### E-Commerce Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `line_plans` | HOT Mobile plans | `name_ar`, `name_he`, `data_amount`, `price`, `features_ar/he`, `popular` |
| `coupons` | Discount coupons | `code`, `type` (percent/fixed), `value`, `min_order`, `max_uses`, `expires_at` |
| `heroes` | Hero carousel | `title_ar`, `title_he`, `image_url`, `link_url`, `cta_text_ar/he` |
| `deals` | Flash sales | `title_ar/he`, `product_id`, `deal_type`, `discount_percent`, `starts_at` |
| `product_reviews` | Customer reviews | `product_id`, `customer_id`, `rating`, `title`, `body`, `verified_purchase` |
| `abandoned_carts` | Cart recovery | `visitor_id`, `customer_phone`, `items` (JSONB), `total` |

### Loyalty Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `loyalty_points` | Customer balance | `customer_id`, `points`, `lifetime_points`, `tier` (bronze/silver/gold/platinum) |
| `loyalty_transactions` | Points history | `customer_id`, `type` (earn/redeem/expire), `points`, `order_id` |

### CRM Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `inbox_conversations` | Unified inbox | `customer_phone/name`, `channel`, `status`, `assigned_to`, `priority` |
| `inbox_messages` | Chat messages | `conversation_id`, `direction`, `message_type`, `content`, `media_url` |
| `inbox_labels` | Conversation labels | `name`, `color`, `sort_order` |
| `inbox_templates` | Quick reply templates | `name`, `category`, `content`, `variables` |
| `pipeline_deals` | Sales pipeline | `customer_id/name`, `value`, `stage`, `assigned_to` |
| `pipeline_stages` | Pipeline stages | `name`, `sort_order`, `color`, `is_won/is_lost` |
| `tasks` | Task management | `title`, `customer_id`, `assigned_to`, `priority`, `status`, `due_date` |

### Bot Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `bot_conversations` | Bot sessions | `visitor_id`, `channel` (webchat/whatsapp/sms), `customer_id`, `status` |
| `bot_messages` | Bot messages | `conversation_id`, `role` (user/bot/system), `content`, `intent` |
| `bot_handoffs` | Escalation to human | `conversation_id`, `reason`, `summary`, `assigned_to` |
| `bot_policies` | Bot policy docs | `type`, `title_ar/he`, `content_ar/he` |
| `bot_templates` | Bot responses | `key`, `content_ar/he`, `channel`, `variables` |
| `bot_analytics` | Bot usage stats | `date`, `channel`, `total_conversations`, `handoffs`, `top_intents` |

### Commission Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `commission_sales` | Sales records | `user_id/employee_id`, `sale_date`, `sale_type` (line/device), `customer_name`, `commission_amount` |
| `commission_targets` | Monthly targets | `user_id`, `month`, `target_lines_amount`, `target_devices_amount` |
| `commission_sanctions` | Deductions | `user_id/employee_id`, `sanction_date`, `sanction_type`, `amount` |
| `commission_sync_log` | Sync audit | `sync_date`, `orders_synced`, `orders_skipped`, `status` |
| `employee_commission_profiles` | Per-employee config | `user_id`, `line_multiplier`, `device_rate`, `device_milestone_bonus` |
| `commission_employees` | Employee directory | `name`, `phone`, `token`, `role`, `active` |

### PWA / Sales Docs Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `sales_docs` | Sales documents | `doc_uuid`, `employee_user_id`, `sale_type`, `status`, `total_amount` |
| `sales_doc_items` | Document items | `sales_doc_id`, `item_type`, `product_id`, `qty`, `unit_price` |
| `sales_doc_attachments` | Document files | `sales_doc_id`, `file_path`, `file_name`, `mime_type` |
| `sales_doc_events` | Document audit | `sales_doc_id`, `event_type`, `actor_user_id`, `payload` |
| `sales_doc_sync_queue` | Sync queue | `sales_doc_id`, `sync_target`, `status` (pending/processing/done/failed) |

### System Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `audit_log` | Full audit trail | `user_id`, `action`, `entity_type`, `entity_id`, `details` |
| `notifications` | User notifications | `user_id`, `type`, `title`, `body`, `link` |
| `push_subscriptions` | Web push subs | `endpoint`, `keys` (JSONB), `visitor_id` |
| `push_notifications` | Push messages sent | `title`, `body`, `target`, `target_filter` |
| `customer_otps` | OTP verification | `phone`, `otp`, `expires_at`, `verified` |
| `website_content` | CMS content | `section`, `title_ar/he`, `content` (JSONB) |
| `email_templates` | Email templates | `slug`, `subject_ar/he`, `body_html_ar/he`, `variables` |

### Enums & Constants

| Enum | Values |
|------|--------|
| **Order Status** | `new` → `approved` → `processing` → `shipped` → `delivered` (or `cancelled` / `rejected`) |
| **Order Source** | `store`, `facebook`, `external`, `whatsapp`, `webchat`, `manual` |
| **User Role** | `super_admin` > `admin` > `sales` > `support` > `content` > `viewer` |
| **Customer Segment** | `vip`, `loyal`, `active`, `new`, `cold`, `lost`, `inactive` |
| **Loyalty Tier** | `bronze` → `silver` → `gold` → `platinum` |
| **Bot Channel** | `webchat`, `whatsapp`, `sms` |
| **Commission Sale Type** | `line`, `device` |
| **Pipeline Stage** | `lead` → `negotiation` → `proposal` → `won` / `lost` |
| **Sanction Types** | 9 predefined types (1,000–2,500 ILS each) |

### Migration History

39 sequential migrations in `supabase/migrations/`:

| # | Migration | Purpose |
|---|-----------|---------|
| 001 | `initial_schema` | Core tables (products, orders, customers, users, settings) |
| 002 | `functions` | PL/pgSQL functions |
| 003 | `bot_tables` | Bot conversation engine |
| 004 | `bot_fixes` | Bot schema fixes |
| 005 | `features` | Reviews, deals, abandoned carts |
| 006 | `customer_auth` | Customer OTP authentication |
| 007 | `inbox` | Inbox conversations + messages |
| 008 | `ai_enhancement` | AI enhancement fields |
| 009 | `product_variants_and_cms` | Product variants, CMS tables |
| 010 | `populate_product_variants` | Seed variant data |
| 011 | `fix_product_colors` | Color schema fix |
| 012 | `product_name_en` | English name field |
| 013 | `reset_stocks` | Stock reset |
| 014 | `sub_pages` | Sub-page content |
| 015 | `template_usage_rpc` | Template usage RPC |
| 016 | `whatsapp_templates` | WhatsApp template management |
| 017 | `tighten_rls_policies` | Row-level security hardening |
| 018 | `add_integration_types` | Integration type enum |
| 019 | `user_management` | User roles & permissions |
| 020 | `rate_limits` | Rate limit tables |
| 021 | `atomic_order_and_rls_fix` | Atomic order creation + RLS fix |
| 022 | `order_status_alignment` | Status standardization |
| 023 | `stock_coupon_integrity` | Referential integrity constraints |
| 024 | `performance_indexes` | Query optimization indexes |
| 025 | `commissions` | Commission tables (sales, targets, sanctions) |
| 026 | `commissions_lock_and_analytics` | Lock mechanisms + analytics |
| 027 | `employee_commission_profiles` | Per-employee profiles |
| 028 | `team_commissions` | Team-level commission tracking |
| 029 | `commission_employees` | Employee directory |
| 030 | `commission_soft_delete` | Soft delete support |
| 031 | `loyalty` | Loyalty program (points, tiers, transactions) |
| 032 | `notifications` | User notification system |
| 033 | `employee_unification` | Employee user consolidation |
| 034 | `rbac_permissions` | Role-based access control |
| 035 | `order_management_pipeline` | Order pipeline enhancements |
| 036 | `soft_delete` | Global soft delete patterns |
| 037 | `payment_callback_rpc` | Payment callback RPC |
| 038 | `customer_management_360` | Customer 360° view |
| 039 | `sales_docs_pwa` | Sales documents for PWA |

---

## 5. API Reference

### Admin APIs (`/api/admin/`)

#### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/products` | List products (paginated, filterable) |
| POST | `/api/admin/products` | Create product |
| GET | `/api/admin/products/[id]` | Get product detail |
| PUT | `/api/admin/products/[id]` | Update product |
| DELETE | `/api/admin/products/[id]` | Delete product |
| POST | `/api/admin/products/autofill` | AI-powered autofill from model name |
| POST | `/api/admin/products/bulk-color-images` | Bulk upload color images |
| POST | `/api/admin/products/color-image` | Upload single color image |
| POST | `/api/admin/products/distribute-stock` | Distribute stock across variants |
| GET | `/api/admin/products/export` | Export products |
| POST | `/api/admin/products/import-image` | Import product image |
| GET | `/api/admin/products/pexels` | Fetch images from Pexels |

#### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/categories` | List categories |
| POST | `/api/admin/categories` | Create category |
| PUT | `/api/admin/categories/[id]` | Update category |
| DELETE | `/api/admin/categories/[id]` | Delete category |

#### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/orders` | List orders |
| POST | `/api/admin/orders/create` | Create order (admin) |
| GET | `/api/admin/orders/[id]` | Get order detail |
| GET | `/api/admin/order` | Legacy order endpoint |

#### Deals & Promotions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/deals` | List/create deals |
| PUT/DELETE | `/api/admin/deals/[id]` | Update/delete deal |
| GET/POST | `/api/admin/coupons` | List/create coupons |
| PUT/DELETE | `/api/admin/coupons/[id]` | Update/delete coupon |

#### Content Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/heroes` | Hero carousel |
| PUT/DELETE | `/api/admin/heroes/[id]` | Update/delete hero |
| GET/PUT | `/api/admin/homepage` | Homepage CMS |
| GET/PUT | `/api/admin/website` | Website content |
| GET/POST | `/api/admin/sub-pages` | Sub-page management |
| PUT/DELETE | `/api/admin/sub-pages/[id]` | Update/delete sub-page |

#### Lines & Prices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/admin/lines` | HOT Mobile line plans |
| GET/POST | `/api/admin/prices` | Price management |
| PUT/DELETE | `/api/admin/prices/[id]` | Update/delete prices |
| POST | `/api/admin/prices/apply` | Apply price changes |
| POST | `/api/admin/prices/match-direct` | Direct price matching |

#### Reviews & Push
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/reviews` | Review management |
| PATCH | `/api/admin/reviews/[id]` | Update review status |
| GET/POST | `/api/admin/push` | Push notifications |
| DELETE | `/api/admin/push/[id]` | Delete notification |

#### Settings & Integrations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/admin/settings` | System settings |
| GET/POST | `/api/admin/integrations` | Integration management |
| POST | `/api/admin/integrations/test` | Test integration |
| PUT/DELETE | `/api/admin/integrations/[id]` | Update/delete integration |

#### AI & Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/ai-enhance` | AI content enhancement |
| POST | `/api/admin/image-enhance` | AI image enhancement |
| GET | `/api/admin/ai-usage` | AI usage tracking |
| POST | `/api/admin/upload` | File upload |
| POST/DELETE | `/api/admin/upload-logo` | Logo management |

#### Analytics & Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/analytics` | Analytics data |
| GET | `/api/admin/analytics/dashboard` | Dashboard metrics |
| GET | `/api/admin/features/stats` | Feature usage stats |
| POST | `/api/admin/contact-notify` | Contact form notification |
| POST | `/api/admin/supabase-management` | Supabase admin ops |
| GET/POST/DELETE | `/api/admin/whatsapp-templates` | WhatsApp templates |
| POST | `/api/admin/whatsapp-test` | Test WhatsApp template |

### Commission APIs (`/api/admin/commissions/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/commissions/summary` | Bearer token | Lightweight summary for external app |
| GET | `/api/admin/commissions/dashboard` | Bearer/Session | Full dashboard + pace tracking |
| GET | `/api/admin/commissions/analytics` | Session | Multi-month analytics |
| GET/POST | `/api/admin/commissions/sales` | Session/Bearer | CRUD sales records |
| PUT/DELETE | `/api/admin/commissions/sales/[id]` | Session | Update/delete sale |
| GET/POST | `/api/admin/commissions/targets` | Session | Monthly targets |
| PUT/DELETE | `/api/admin/commissions/targets/[id]` | Session | Update/delete target |
| GET/POST | `/api/admin/commissions/sanctions` | Session | Sanctions management |
| PUT/DELETE | `/api/admin/commissions/sanctions/[id]` | Session | Update/delete sanction |
| GET/POST | `/api/admin/commissions/profiles` | Session | Employee commission profiles |
| PUT | `/api/admin/commissions/profiles/[id]` | Session | Update profile |
| GET | `/api/admin/commissions/export` | Session | CSV export |
| GET | `/api/admin/commissions/bridge` | Session | CRM bridge data |
| GET | `/api/admin/commissions/employees/list` | Bearer | Employee list |
| POST | `/api/admin/commissions/sync` | Session | Sync orders → commissions |
| POST | `/api/admin/commissions/calculate` | Session | Calculate commission amounts |

> **Open CORS endpoints:** `summary`, `dashboard`, `sales` (GET), `employees/list` accept Bearer token auth via `COMMISSION_API_TOKEN` env var for external HTML app sync.

### CRM APIs (`/api/crm/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/dashboard` | CRM dashboard overview |
| GET | `/api/crm/customers` | List customers |
| GET/PUT | `/api/crm/customers/[id]` | Customer detail + update |
| GET | `/api/crm/customers/export` | Export customers |
| POST | `/api/crm/customers/reconcile` | Reconcile customer data |
| GET | `/api/crm/chats` | Chat history |
| GET/PUT | `/api/crm/chats/[id]` | Chat detail + update |
| GET/POST | `/api/crm/inbox` | Inbox conversations |
| GET/PUT | `/api/crm/inbox/[id]` | Conversation detail + update |
| GET | `/api/crm/orders` | CRM orders view |
| GET/PUT | `/api/crm/orders/[id]` | Order detail + update |
| GET/POST | `/api/crm/tasks` | Task list + create |
| GET/PUT/DELETE | `/api/crm/tasks/[id]` | Task CRUD |
| GET | `/api/crm/pipeline` | Sales pipeline data |
| GET/PUT | `/api/crm/pipeline/[id]` | Deal detail + update |
| GET | `/api/crm/reports` | CRM reports |
| GET/POST/PUT/DELETE | `/api/crm/users` | Team user management |
| GET/PUT/DELETE | `/api/crm/users/[id]` | User CRUD |

### Public Store APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | Public | Create order |
| GET | `/api/store/autocomplete` | Public | Search autocomplete |
| GET | `/api/store/order-status` | Public | Track order status |
| GET | `/api/store/smart-search` | Public | AI-powered search |
| POST/DELETE | `/api/cart/abandoned` | Public | Abandoned cart recovery |
| GET/PUT | `/api/customer/profile` | Customer | Customer profile |
| GET | `/api/customer/orders` | Customer | Order history |
| GET/POST | `/api/customer/loyalty` | Customer | Loyalty points |
| POST | `/api/auth/customer` | Public | Customer login/registration |
| POST | `/api/reviews` | Customer | Submit review |
| POST | `/api/coupons/validate` | Public | Validate coupon |

### System APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat` | Public | WebChat messages |
| GET/POST | `/api/webhook/whatsapp` | HMAC | WhatsApp webhook |
| GET/POST | `/api/webhook/twilio` | Provider | Twilio SMS webhook |
| POST | `/api/payment/callback` | Provider | Payment callback |
| POST/DELETE | `/api/push/subscribe` | Public | Push subscribe/unsubscribe |
| GET | `/api/push/vapid` | Public | VAPID public key |
| POST | `/api/email` | Internal | Send email |
| GET | `/api/csrf` | Public | Get CSRF token |
| GET | `/api/health` | Public | Health check |
| POST | `/api/contact` | Public | Contact form |
| GET/POST/PATCH | `/api/notifications` | Session | User notifications |
| POST/GET | `/api/cron/reports` | Cron | Generate scheduled reports |
| POST | `/api/cron/cleanup` | Cron | Data cleanup |
| POST | `/api/auth/change-password` | Session | Change password |
| GET | `/api/reports/[type]` | Session | Various report types |

---

## 6. Authentication & Authorization

### Authentication Methods

| Method | Used By | Implementation |
|--------|---------|---------------|
| **Supabase Session** | Admin, CRM, Staff | Cookie-based session via `@supabase/ssr` |
| **Customer OTP** | Store customers | Phone-based OTP via `customer_otps` table |
| **Bearer Token** | Commission external API | `COMMISSION_API_TOKEN` env var |
| **HMAC** | Webhooks | SHA256 signature verification |

### Role-Based Access Control (6-Tier)

```
super_admin > admin > sales > support > content > viewer
```

| Role | Products | Orders | Customers | Settings | Commissions | CMS | Pipeline |
|------|----------|--------|-----------|----------|-------------|-----|----------|
| `super_admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `sales` | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `support` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `content` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `viewer` | 👁 | 👁 | 👁 | ❌ | ❌ | ❌ | ❌ |

*👁 = Read-only*

### Permission Functions

```typescript
// Check specific permission
hasPermission(user, 'orders')    // boolean

// Check page access
canAccessPage(user, '/admin/products')  // boolean

// Route protection
requireAdmin(request)  // throws 401/403 if unauthorized
```

---

## 7. Middleware & Security

**File:** `middleware.ts`

### Security Layers (Applied in Order)

1. **CORS** — Restricted to configured origins
   - Open CORS for: `/api/admin/commissions/summary`, `/api/admin/commissions/dashboard`
2. **Rate Limiting** — Per-route configurable:
   - Login: limited attempts
   - Contact/Email: 5 req / 5 min
   - Payment: 30 req / min
   - Chat: 30 req / min
   - Webhooks: limited
3. **CSRF Protection** — Double-submit cookie pattern
   - **Exempt routes:** `/api/webhook/*`, `/api/cron/*`, `/api/payment/callback`, `/api/csrf`, `/api/orders`
4. **Security Headers:**
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `X-XSS-Protection: 1; mode=block`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Strict-Transport-Security: max-age=31536000`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Database Security
- **Row-Level Security (RLS)** enabled on all tables
- Service role for server operations
- Anonymous role for public reads
- Supabase clients:
  - `createServerSupabase()` — Server components (session scoped)
  - `createBrowserSupabase()` — Client components (session scoped)
  - `createAdminSupabase()` — Service role (bypasses RLS)

### Webhook Security
- HMAC SHA256 signature verification via `lib/webhook-verify.ts`
- Constant-time comparison to prevent timing attacks

---

## 8. Core Modules

### 8.1 Store Module

**Product System:**
- Two types: `device` (phones/tablets) and `accessory`
- Multi-storage variants with separate pricing (e.g., 128GB, 256GB, 512GB)
- Color system: hex code + bilingual names (AR/HE)
- Specifications stored as JSONB
- AI-powered autofill from model name (GSMarena + Gemini)

**Cart & Checkout:**
- Client-side cart state (Zustand + localStorage)
- Multi-step checkout flow
- Automatic payment gateway routing (Rivhit for Israel, UPay for international)
- Coupon validation at checkout

**Features:**
- Product comparison (side-by-side)
- Wishlist (persistent)
- Smart search (AI-powered autocomplete)
- Order tracking by ID
- Customer reviews with moderation
- Loyalty points program (earn on purchase, redeem as discount)

### 8.2 Admin Panel

**15+ Management Pages:**
- Dashboard with real-time stats and alerts
- CRUD for: products, categories, deals, coupons, heroes, line plans, prices
- Homepage CMS editor (drag sections)
- Push notification management
- Review moderation
- Bot configuration
- System settings (site name, logo, contact info)
- Analytics dashboard (sales, traffic, conversion)

### 8.3 CRM Module

**Unified Inbox:**
- Multi-channel: WhatsApp, WebChat, SMS in one view
- Real-time message streaming (Supabase Realtime)
- Agent assignment & transfer
- Quick reply templates
- Conversation labels & priority
- Contact info panel

**Customer 360°:**
- Full profile with order history
- Segment classification (VIP, loyal, active, new, cold, lost, inactive)
- Notes & internal comments
- Loyalty tier & points balance
- Communication history across channels

**Sales Pipeline:**
- Kanban-style stages: Lead → Negotiation → Proposal → Won / Lost
- Deal value tracking
- Agent assignment
- Forecasting

**Task Management:**
- Create, assign, prioritize tasks
- Due dates & status tracking
- Link to customers & orders

### 8.4 Order System

**Order ID Format:** `CLM-XXXXX`

**Status Flow:**
```
new → approved → processing → shipped → delivered
         ↘ cancelled
         ↘ rejected
```

**Sources:** store, facebook, external, whatsapp, webchat, manual

**Features:**
- Admin order creation
- Status pipeline with history audit
- Internal notes
- Agent assignment
- Auto-sync to commission tracking

---

## 9. Commission System

### Overview
Contract-based commission tracking for HOT Mobile dealer operations.

**Location:** `lib/commissions/` + `app/admin/commissions/` (6 sub-pages) + `app/api/admin/commissions/` (16 endpoints)

### Three Revenue Streams

#### 1. Line Commissions
- **Formula:** Package price × 4 multiplier
- **Min threshold:** 19.90 ILS
- Per-employee multiplier configurable in profiles

#### 2. Device Commissions
- **Base rate:** 5% of net device sales
- **Milestone bonuses:** 2,500 ILS per 50,000 ILS sales threshold
- Per-employee rate configurable

#### 3. Loyalty Bonuses
- At **5 months:** 80 ILS per line
- At **9 months:** 30 ILS per line
- At **12 months:** 20 ILS per line
- At **15 months:** 50 ILS per line
- **Total:** 180 ILS per line over 15 months

### Sanctions
9 predefined penalty types (1,000–2,500 ILS each)

### Auto-Sync
- Completed orders from the store automatically sync to `commission_sales` table
- Sync log tracked in `commission_sync_log`

### External API
- Bearer token authenticated endpoints for local HTML app
- Endpoints: `summary`, `dashboard`, `sales`, `employees/list`
- Auth via `COMMISSION_API_TOKEN` env var

### Database Tables
- `commission_sales` — Individual sale records
- `commission_targets` — Monthly targets per employee
- `commission_sanctions` — Sanctions & deductions
- `commission_sync_log` — Sync audit trail
- `employee_commission_profiles` — Per-employee configuration
- `commission_employees` — Employee directory

---

## 10. Bot Engine

### Overview
14-module AI-powered chatbot engine supporting multiple channels.

**Location:** `lib/bot/` (14 files)

### Modules

| Module | File | Purpose |
|--------|------|---------|
| **Engine** | `engine.ts` | Core message processing pipeline |
| **AI** | `ai.ts` | Anthropic Claude conversation engine |
| **Intents** | `intents.ts` | Intent detection & classification |
| **Playbook** | `playbook.ts` | Conversation flow scripts |
| **Guardrails** | `guardrails.ts` | Safety filters & content moderation |
| **Handoff** | `handoff.ts` | Escalation to human agents |
| **Templates** | `templates.ts` | Response template system |
| **Policies** | `policies.ts` | Business policy knowledge base |
| **WebChat** | `webchat.ts` | WebChat channel integration |
| **WhatsApp** | `whatsapp.ts` | WhatsApp channel (YCloud API) |
| **Analytics** | `analytics.ts` | Bot usage analytics |
| **Notifications** | `notifications.ts` | Bot notification system |
| **Admin Notify** | `admin-notify.ts` | Admin alerts for bot events |

### Channels
- **WebChat** — Embedded widget (`components/chat/WebChatWidget.tsx`)
- **WhatsApp** — Via YCloud API (webhook at `/api/webhook/whatsapp`)
- **SMS** — Via Twilio (webhook at `/api/webhook/twilio`)

### Flow
```
User Message → Intent Detection → Playbook Match?
  ├── Yes → Execute playbook response
  └── No → AI (Claude) → Guardrails → Response
              └── Unsafe? → Handoff to human agent
```

---

## 11. Integrations

### Provider Registry Pattern

**File:** `lib/integrations/hub.ts`

All integrations use a provider registry pattern. Configuration stored in `integrations` DB table.

### Payment Gateways

| Provider | File | Region | Features |
|----------|------|--------|----------|
| **Rivhit (iCredit)** | `rivhit.ts` | Israeli cities | Installment payments, ILS |
| **UPay** | `upay.ts` | International | Multi-currency |

**Auto-detection:** City-based routing via `lib/cities.ts` — Israeli cities → Rivhit, others → UPay.

### Messaging

| Provider | File | Channel | Purpose |
|----------|------|---------|---------|
| **YCloud** | `ycloud-wa.ts` | WhatsApp | Bot + inbox messaging |
| **YCloud** | `ycloud-templates.ts` | WhatsApp | Template management |
| **Twilio** | `twilio-sms.ts` | SMS | Bot + notifications |

### Email

| Provider | File | Purpose |
|----------|------|---------|
| **SendGrid** | `sendgrid.ts` | Transactional emails |
| **Resend** | `resend.ts` | Alternative email provider |

### AI

| Provider | Purpose |
|----------|---------|
| **Anthropic Claude** | Bot responses, content enhancement |
| **Google Gemini** | Fallback AI, product autofill |

### Other

| Provider | File | Purpose |
|----------|------|---------|
| **Remove.bg** | `removebg.ts` | Background removal from product images |

---

## 12. Internationalization

### Languages
- **Arabic** (primary) — `locales/ar.json`
- **Hebrew** (secondary) — `locales/he.json`
- Both RTL (right-to-left)

### Implementation
- **Static text:** JSON translation files with namespaced keys (`nav.*`, `store.*`, `admin.*`)
- **Dynamic content:** Database columns use `*_ar` / `*_he` suffixes (e.g., `name_ar`, `name_he`)
- **Language switcher:** `components/shared/LangSwitcher.tsx`
- **i18n hook:** `lib/i18n.tsx`

### Usage Pattern
```typescript
// Static text
const t = useTranslation();
<h1>{t('store.title')}</h1>

// Dynamic content from DB
<h2>{lang === 'ar' ? product.name_ar : product.name_he}</h2>
```

---

## 13. Design System

**File:** `tailwind.config.ts`

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `brand` | `#c41040` | Primary brand red |
| `brand-light` | — | Lighter variant |
| `brand-dark` | — | Darker variant |
| `surface-bg` | `#09090b` | Page background |
| `surface-card` | `#111114` | Card background |
| `surface-elevated` | `#18181b` | Elevated elements |
| `success` | Green | Success states |
| `warning` | Yellow | Warning states |
| `error` | Red | Error states |
| `info` | Blue | Info states |

### Typography
| Language | Font |
|----------|------|
| Arabic | Tajawal |
| Hebrew | David Libre / Heebo |

### Spacing & Radius
| Token | Value |
|-------|-------|
| `radius-card` | 14px |
| `radius-button` | 10px |
| `radius-chip` | 8px |

### Breakpoints
| Name | Width |
|------|-------|
| Mobile | ≤ 767px |
| Tablet | 768–1023px |
| Desktop | ≥ 1024px |

---

## 14. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key (server only)

# AI
ANTHROPIC_API_KEY=                # Claude API key
GEMINI_API_KEY=                   # Google Gemini API key

# WhatsApp (YCloud)
YCLOUD_API_KEY=                   # YCloud API key
YCLOUD_WHATSAPP_NUMBER=           # WhatsApp business number
YCLOUD_WEBHOOK_SECRET=            # Webhook signature secret

# SMS (Twilio)
TWILIO_ACCOUNT_SID=               # Twilio account SID
TWILIO_AUTH_TOKEN=                 # Twilio auth token
TWILIO_PHONE_NUMBER=              # Twilio phone number

# Email
SENDGRID_API_KEY=                 # SendGrid API key
RESEND_API_KEY=                   # Resend API key

# Payment
RIVHIT_API_KEY=                   # Rivhit (iCredit) API key
UPAY_API_KEY=                     # UPay API key
UPAY_MERCHANT_ID=                 # UPay merchant ID

# Commissions
COMMISSION_API_TOKEN=             # Bearer token for external commission API

# Cloudflare
CLOUDFLARE_R2_ACCESS_KEY=        # R2 access key
CLOUDFLARE_R2_SECRET_KEY=        # R2 secret key
CLOUDFLARE_R2_BUCKET=            # R2 bucket name

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=    # VAPID public key
VAPID_PRIVATE_KEY=               # VAPID private key

# Other
NEXT_PUBLIC_SITE_URL=            # Public site URL
REMOVE_BG_API_KEY=               # Remove.bg API key
```

---

## 15. Deployment

### Platform
Cloudflare Pages (edge) via OpenNext adapter.

### Build Steps

```bash
# Full deployment (all 3 steps required):
npm run build                      # 1. Next.js production build
npx opennextjs-cloudflare build    # 2. OpenNext adapter (generates worker.js)
npx wrangler deploy                # 3. Deploy to Cloudflare Pages
```

> **Important:** Skipping step 2 means wrangler deploys a stale worker bundle.

### Cloudflare Configuration (`wrangler.json`)
- **Main worker:** `.open-next/worker.js`
- **Compatibility date:** 2026-04-01
- **Flags:** `nodejs_compat`, `global_fetch_strictly_public`
- **R2 Bucket:** `clalstore-opennext-cache` (static cache)
- **Worker self-reference binding** for edge rendering

### Scripts
```bash
npm run build:cf    # Combined: next build + opennextjs-cloudflare build
npm run deploy:cf   # Combined: build:cf + wrangler deploy
```

---

## 16. Testing

### Framework
Vitest 4.0 with JSDOM environment.

### Configuration
**File:** `vitest.config.ts`

### Test Structure
```
tests/
├── setup.ts                    # Test setup & mocks
└── unit/
    ├── auth.test.ts            # Authentication logic
    ├── analytics.test.ts       # Analytics events
    ├── cart.test.ts            # Shopping cart logic
    ├── commissions.test.ts     # Commission calculations
    ├── constants.test.ts       # Constants validation
    └── seo.test.ts             # SEO utilities
```

### Commands
```bash
npm run test                    # Watch mode
npm run test:run                # Single run
npm run test:coverage           # Coverage report
npm run test:run -- tests/unit/auth.test.ts           # Single file
npm run test:run -- tests/unit/auth.test.ts -t "name" # Single test
```

---

## Code Conventions

### Style
- **Prettier:** 2 spaces, semicolons, double quotes, trailing commas, max width 100
- **Import order:** Framework → External → `@/*` aliases → Relative
- **Naming:** `PascalCase` components, `camelCase` functions/variables, `UPPER_SNAKE_CASE` constants

### API Route Pattern
```typescript
// app/api/admin/example/route.ts
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { validateBody } from "@/lib/admin/validators";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);        // Auth check
  // ... business logic
  return apiSuccess(data);                         // Structured response
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  const body = await validateBody(request, schema); // Zod validation
  // ... business logic
  return apiSuccess(result, 201);
}
```

### Supabase Client Usage
```typescript
// Server component
const supabase = createServerSupabase();

// Client component
const supabase = createBrowserSupabase();

// Service role (bypasses RLS)
const supabase = createAdminSupabase();
```

### Error Handling
- Never expose `err.message` in production responses
- Use generic error messages via `apiError("Something went wrong", 500)`
- Log detailed errors server-side only
