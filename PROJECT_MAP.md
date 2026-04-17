# 🗺️ ClalMobile - Project Map
> Auto-generated project map for season continuity and test planning.
> Every new season MUST read this file before starting any work.

---

Generated: 2026-04-17 18:49:36


## 1. 📜 Immutable Project Rules

These rules are **non-negotiable** across ALL seasons:

| # | Rule | Details |
|---|------|---------|
| 1 | **Responsiveness** | Every app works on mobile (tab nav, compact) AND desktop (sidebar, grids). Never mobile-only. |
| 2 | **useScreen() hook** | All responsive logic uses the custom `useScreen()` hook. No raw media queries. |
| 3 | **Strict TypeScript** | Zero TS errors before any phase is complete. `strict: true` in tsconfig. |
| 4 | **Images = uploaded files** | Images are uploaded files, never external URLs. |
| 5 | **RTL + Bilingual** | Full Arabic + Hebrew support. RTL layout throughout. |
| 6 | **Tailwind theming only** | All theming via Tailwind config. No inline style overrides for theming. |
| 7 | **Zustand state** | Zustand for ALL state management. No Redux, no Context for global state. |
| 8 | **Supabase only** | Supabase (PostgreSQL) exclusively for database access. |
| 9 | **Service files** | All external integrations routed through dedicated service files. |
| 10 | **Git hygiene** | Clean commits, deployment-ready at all times. |
| 11 | **Integration Hub** | 6-provider swappable architecture for all external services. |
| 12 | **Error boundaries** | Every route segment needs `error.tsx`. |


## 2. 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (RTL) |
| Database | Supabase (PostgreSQL) |
| Hosting | Cloudflare Pages |
| State | Zustand |
| WhatsApp | yCloud |
| Payments | Rivhit Gateway |
| AI | Claude API |
| Image Optimization | Disabled (Cloudflare Pages constraint) |


## 3. 📁 Directory Structure

```
.
./.claude
./.claude/settings.local.json
./.claude/worktrees
./.claude/worktrees/nifty-hopper
./.cursor
./.cursor/plans
./.cursor/plans/clalmobile_full_audit_822b8047.plan.md
./.cursor/settings.json
./.env.example
./.env.local
./.git
./.github
./.github/prompts
./.github/prompts/audit-notifications.prompt.md
./.github/workflows
./.github/workflows/scheduled-reports.yml
./.gitignore
./.next
./.npmrc
./.open-next
./.open-next/.build
./.open-next/.build/cache.cjs
./.open-next/.build/composable-cache.cjs
./.open-next/.build/durable-objects
./.open-next/.build/open-next.config.edge.mjs
./.open-next/.build/open-next.config.mjs
./.open-next/assets
./.open-next/assets/BUILD_ID
./.open-next/assets/_next
./.open-next/assets/icons
./.open-next/assets/m-manifest.json
./.open-next/assets/manifest.json
./.open-next/assets/pdf.worker.min.mjs
./.open-next/assets/sales-pwa
./.open-next/assets/sw.js
./.open-next/assets/t
./.open-next/cache
./.open-next/cache/2XK10vmVKzQc1ckJicrs4
./.open-next/cache/__fetch
./.open-next/cloudflare
./.open-next/cloudflare-templates
./.open-next/cloudflare-templates/images.d.ts
./.open-next/cloudflare-templates/images.js
./.open-next/cloudflare-templates/init.d.ts
./.open-next/cloudflare-templates/init.js
./.open-next/cloudflare-templates/shims
./.open-next/cloudflare-templates/skew-protection.d.ts
./.open-next/cloudflare-templates/skew-protection.js
./.open-next/cloudflare-templates/worker.d.ts
./.open-next/cloudflare-templates/worker.js
./.open-next/cloudflare/cache-assets-manifest.sql
./.open-next/cloudflare/images.js
./.open-next/cloudflare/init.js
./.open-next/cloudflare/next-env.mjs
./.open-next/cloudflare/skew-protection.js
./.open-next/dynamodb-provider
./.open-next/dynamodb-provider/dynamodb-cache.json
./.open-next/dynamodb-provider/open-next.config.mjs
./.open-next/middleware
./.open-next/middleware/assets
./.open-next/middleware/handler.mjs
./.open-next/middleware/open-next.config.mjs
./.open-next/middleware/wasm
./.open-next/server-functions
./.open-next/server-functions/default
./.open-next/worker.js
./.prettierignore
./.prettierrc.json
./.sixth
./.sixth/skills
./.vscode
./.vscode/extensions.json
./.vscode/settings.json
./.wrangler
./.wrangler/state
./.wrangler/state/v3
./.wrangler/tmp
./.wrangler/tmp/bundle-SO5rcd
./.wrangler/tmp/dev-tWMELK
./AGENTS.md
./AUDIT-SCRIPT.md
./CUSTOMER-RETENTION-IMPLEMENTATION.md
./CUSTOMER-RETENTION-STAFF-ADMIN-GUIDE.md
./CUSTOMER-RETENTION-TECHNICAL-HANDOFF.md
./DOCS.md
./FULL-AUDIT-2026-03-31.md
./LAUNCH.md
./NOTIFICATION-AUDIT-2026-03-31.md
./NOTIFICATION-FLOWS.md
./PROJECT_MAP.md
./README.md
./app
./app/(auth)
./app/(auth)/login
./app/about
./app/about/page.tsx
./app/admin
./app/admin/analytics
./app/admin/bot
./app/admin/categories
./app/admin/commissions
./app/admin/coupons
./app/admin/deals
./app/admin/error.tsx
./app/admin/features
./app/admin/heroes
./app/admin/homepage
./app/admin/layout.tsx
./app/admin/lines
./app/admin/loading.tsx
./app/admin/order
./app/admin/orders
./app/admin/page.tsx
./app/admin/prices
./app/admin/products
./app/admin/push
./app/admin/reviews
./app/admin/settings
./app/admin/website
./app/api
./app/api/admin
./app/api/auth
./app/api/cart
./app/api/chat
./app/api/contact
./app/api/coupons
./app/api/crm
./app/api/cron
./app/api/csrf
./app/api/customer
./app/api/email
./app/api/health
./app/api/notifications
./app/api/orders
./app/api/payment
./app/api/push
./app/api/pwa
./app/api/reports
./app/api/reviews
./app/api/settings
./app/api/store
./app/api/webhook
./app/change-password
./app/change-password/page.tsx
./app/command-center
./app/command-center/page.tsx
./app/contact
./app/contact/page.tsx
./app/crm
./app/crm/chats
./app/crm/customers
./app/crm/error.tsx
./app/crm/inbox
./app/crm/layout.tsx
./app/crm/loading.tsx
./app/crm/orders
./app/crm/page.tsx
./app/crm/pipeline
./app/crm/reports
./app/crm/tasks
./app/crm/users
./app/deals
./app/deals/page.tsx
./app/error.tsx
./app/faq
./app/faq/page.tsx
./app/fonts.ts
./app/global-error.tsx
./app/layout.tsx
./app/legal
./app/legal/page.tsx
./app/loading.tsx
./app/m
./app/m/inbox
./app/m/layout.tsx
./app/not-found.tsx
./app/page.tsx
./app/privacy
./app/privacy/page.tsx
./app/robots.ts
./app/sales-pwa
./app/sales-pwa/docs
./app/sales-pwa/layout.tsx
./app/sales-pwa/new
./app/sales-pwa/page.tsx
./app/sitemap.ts
./app/store
./app/store/account
./app/store/auth
./app/store/cart
./app/store/checkout
./app/store/compare
./app/store/contact
./app/store/error.tsx
./app/store/layout.tsx
./app/store/loading.tsx
./app/store/page.tsx
./app/store/product
./app/store/track
./app/store/wishlist
./clalmobile-project-map.sh
./components
./components/CommandCenter.tsx
./components/admin
./components/admin/AdminShell.tsx
./components/admin/ImageUpload.tsx
./components/admin/charts
./components/admin/shared.tsx
./components/chat
./components/chat/WebChatWidget.tsx
./components/command-center
./components/command-center/data.ts
./components/command-center/types.ts
./components/command-center/ui.tsx
./components/crm
./components/crm/CRMShell.tsx
./components/crm/OrdersManagementPage.tsx
./components/crm/inbox
./components/mobile
./components/mobile/MobileChat.tsx
./components/mobile/MobileHeader.tsx
./components/mobile/MobileInbox.tsx
./components/mobile/MobileMessageInput.tsx
./components/mobile/MobilePushInit.tsx
./components/orders
./components/orders/ManualOrderModal.tsx
./components/pwa
./components/pwa/SalesPwaInit.tsx
./components/shared
./components/shared/Analytics.tsx
./components/shared/Analytics.tsx.bak
./components/shared/CookieConsent.tsx
./components/shared/LangSwitcher.tsx
./components/shared/Logo.tsx
./components/shared/PWAInstallPrompt.tsx
./components/shared/Providers.tsx
./components/store
./components/store/CompareBar.tsx
./components/store/FloatingActions.tsx
./components/store/HeroCarousel.tsx
./components/store/LinePlans.tsx
./components/store/LoyaltyWidget.tsx
./components/store/ProductCard.tsx
./components/store/ProductDetail.tsx
./components/store/ProductReviews.tsx
./components/store/ReviewsSection.tsx
./components/store/SearchFilters.tsx
./components/store/SmartSearchBar.tsx
./components/store/StickyCartBar.tsx
./components/store/StoreClient.tsx
./components/store/StoreHeader.tsx
./components/store/cart
./components/store/index.ts
./components/ui
./components/ui/Toast.tsx
./components/website
./components/website/HomeClient.tsx
./components/website/index.ts
./components/website/sections.tsx
./eslint.config.mjs
./global.d.ts
./lib
./lib/admin
./lib/admin/ai-tools.ts
./lib/admin/auth.ts
./lib/admin/device-data.ts
./lib/admin/gsmarena.ts
./lib/admin/hooks.ts
./lib/admin/index.ts
./lib/admin/mobileapi.ts
./lib/admin/queries.ts
./lib/admin/validators.ts
./lib/ai
./lib/ai/claude.ts
./lib/ai/gemini.ts
./lib/ai/product-context.ts
./lib/ai/usage-tracker.ts
./lib/analytics-events.ts
./lib/api-response.ts
./lib/auth.ts
./lib/bot
./lib/bot/admin-notify.ts
./lib/bot/ai.ts
./lib/bot/analytics.ts
./lib/bot/engine.ts
./lib/bot/guardrails.ts
./lib/bot/handoff.ts
./lib/bot/index.ts
./lib/bot/intents.ts
./lib/bot/notifications.ts
./lib/bot/playbook.ts
./lib/bot/policies.ts
./lib/bot/templates.ts
./lib/bot/webchat.ts
./lib/bot/whatsapp.ts
./lib/brand-config.ts
./lib/brand-logos.ts
./lib/cities.ts
./lib/commissions
./lib/commissions/calculator.ts
./lib/commissions/crm-bridge.ts
./lib/commissions/ledger.ts
./lib/commissions/sync-orders.ts
./lib/constants.ts
./lib/crm
./lib/crm/customer-timeline.ts
./lib/crm/inbox-types.ts
./lib/crm/inbox.ts
./lib/crm/index.ts
./lib/crm/pipeline.ts
./lib/crm/queries.ts
./lib/crm/realtime.ts
./lib/crm/sentiment.ts
./lib/crypto.ts
./lib/csrf-client.ts
./lib/csrf.ts
./lib/customer-auth.ts
./lib/email-templates.ts
./lib/hooks.ts
./lib/i18n.tsx
./lib/integrations
./lib/integrations/hub.ts
./lib/integrations/index.ts
./lib/integrations/removebg.ts
./lib/integrations/resend.ts
./lib/integrations/rivhit.ts
./lib/integrations/sendgrid.ts
./lib/integrations/twilio-sms.ts
./lib/integrations/upay.ts
./lib/integrations/ycloud-templates.ts
./lib/integrations/ycloud-wa.ts
./lib/loyalty.ts
./lib/notifications.ts
./lib/orders
./lib/orders/admin.ts
./lib/payment-gateway.ts
./lib/pdf-export.ts
./lib/public-site-url.ts
./lib/pwa
./lib/pwa/auth.ts
./lib/pwa/customer-linking.ts
./lib/pwa/validators.ts
./lib/rate-limit-db.ts
./lib/rate-limit.ts
./lib/reports
./lib/reports/service.ts
./lib/seo.ts
./lib/storage-r2.ts
./lib/storage.ts
./lib/store
./lib/store/cart.ts
./lib/store/compare.ts
./lib/store/index.ts
./lib/store/queries.ts
./lib/store/wishlist.ts
./lib/supabase-management.ts
./lib/supabase.ts
./lib/utils.ts
./lib/validators.ts
./lib/webhook-verify.ts
./locales
./locales/ar.json
./locales/he.json
./middleware.ts
./next-env.d.ts
./next.config.js
./node_modules
./open-next.config.ts
./package-lock.json
./package.json
./postcss.config.js
./public
./public/icons
./public/icons/apple-touch-icon.svg
./public/icons/favicon.svg
./public/icons/icon-128x128.svg
./public/icons/icon-144x144.svg
./public/icons/icon-152x152.svg
./public/icons/icon-192x192.svg
./public/icons/icon-384x384.svg
./public/icons/icon-512x512.svg
./public/icons/icon-72x72.svg
./public/icons/icon-96x96.svg
./public/icons/icon-maskable-192x192.svg
./public/icons/icon-maskable-512x512.svg
./public/icons/icredit-logo.svg
./public/icons/upay-logo.svg
./public/m-manifest.json
./public/manifest.json
./public/pdf.worker.min.mjs
./public/sales-pwa
./public/sales-pwa/manifest.json
./public/sales-pwa/sw.js
./public/sw.js
./public/t
./public/t/e99374f44001
./scripts
./scripts/create-wa-templates.js
./scripts/extract-prices.js
./scripts/generate-icons.js
./scripts/list-products.js
./scripts/run-migration-028.ts
./styles
./styles/globals.css
./supabase
./supabase/.temp
./supabase/.temp/cli-latest
./supabase/.temp/gotrue-version
./supabase/.temp/pooler-url
./supabase/.temp/postgres-version
./supabase/.temp/project-ref
./supabase/.temp/rest-version
./supabase/.temp/storage-migration
./supabase/.temp/storage-version
./supabase/migrations
./supabase/migrations/20260101000001_initial_schema.sql
./supabase/migrations/20260101000002_functions.sql
./supabase/migrations/20260101000003_bot_tables.sql
./supabase/migrations/20260101000004_bot_fixes.sql
./supabase/migrations/20260101000005_features.sql
./supabase/migrations/20260101000006_customer_auth.sql
./supabase/migrations/20260101000007_inbox.sql
./supabase/migrations/20260101000008_ai_enhancement.sql
./supabase/migrations/20260101000009_product_variants_and_cms.sql
./supabase/migrations/20260101000010_populate_product_variants.sql
./supabase/migrations/20260101000011_fix_product_colors.sql
./supabase/migrations/20260101000012_product_name_en.sql
./supabase/migrations/20260101000013_reset_stocks.sql
./supabase/migrations/20260101000014_sub_pages.sql
./supabase/migrations/20260101000015_template_usage_rpc.sql
./supabase/migrations/20260101000016_whatsapp_templates.sql
./supabase/migrations/20260101000017_tighten_rls_policies.sql
./supabase/migrations/20260101000018_add_integration_types.sql
./supabase/migrations/20260101000019_user_management.sql
./supabase/migrations/20260101000020_rate_limits.sql
./supabase/migrations/20260101000021_atomic_order_and_rls_fix.sql
./supabase/migrations/20260101000022_order_status_alignment.sql
./supabase/migrations/20260101000023_stock_coupon_integrity.sql
./supabase/migrations/20260101000024_performance_indexes.sql
./supabase/migrations/20260101000025_commissions.sql
./supabase/migrations/20260101000026_commissions_lock_and_analytics.sql
./supabase/migrations/20260101000027_employee_commission_profiles.sql
./supabase/migrations/20260101000028_team_commissions.sql
./supabase/migrations/20260101000029_commission_employees.sql
./supabase/migrations/20260101000030_commission_soft_delete.sql
./supabase/migrations/20260311000001_loyalty.sql
./supabase/migrations/20260311000002_notifications.sql
./supabase/migrations/20260406000001_employee_unification.sql
./supabase/migrations/20260406000002_rbac_permissions.sql
./supabase/migrations/20260407000001_order_management_pipeline.sql
./supabase/migrations/20260407000002_soft_delete.sql
./supabase/migrations/20260407000003_payment_callback_rpc.sql
./supabase/migrations/20260408000001_customer_management_360.sql
./supabase/migrations/20260410000001_sales_docs_pwa.sql
./supabase/migrations/20260411000001_customer_identity.sql
./supabase/migrations/20260411000002_commission_customer_link.sql
./supabase/migrations/20260411000003_sales_docs_customer_fk_and_commission_backfill.sql
./supabase/migrations/20260412000001_commission_identity_enrichment.sql
./supabase/seed
./supabase/seed/seed.sql
./supabase/seed/update_images.sql
./supabase/update-products.sql
./tailwind.config.ts
./tests
./tests/setup.ts
./tests/unit
./tests/unit/analytics.test.ts
./tests/unit/auth.test.ts
./tests/unit/cart.test.ts
./tests/unit/commissions.test.ts
./tests/unit/constants.test.ts
./tests/unit/customer-retention.test.ts
./tests/unit/customer-timeline.test.ts
./tests/unit/public-site-url.test.ts
./tests/unit/seo.test.ts
./tsconfig.json
./types
./types/database.ts
./vitest.config.ts
./wrangler.json
```

## 4. 📂 Deep Structure (Key Directories)

### `app/`
```
./app/(auth)/login/page.tsx
./app/about/page.tsx
./app/admin/analytics/page.tsx
./app/admin/bot/page.tsx
./app/admin/categories/page.tsx
./app/admin/commissions/analytics/page.tsx
./app/admin/commissions/calculator/page.tsx
./app/admin/commissions/history/page.tsx
./app/admin/commissions/import/page.tsx
./app/admin/commissions/live/page.tsx
./app/admin/commissions/page.tsx
./app/admin/commissions/sanctions/page.tsx
./app/admin/commissions/team/page.tsx
./app/admin/coupons/page.tsx
./app/admin/deals/page.tsx
./app/admin/error.tsx
./app/admin/features/page.tsx
./app/admin/heroes/page.tsx
./app/admin/homepage/BannersSectionEditor.tsx
./app/admin/homepage/CTASectionEditor.tsx
./app/admin/homepage/FAQSectionEditor.tsx
./app/admin/homepage/FeaturesSectionEditor.tsx
./app/admin/homepage/FooterSectionEditor.tsx
./app/admin/homepage/HeaderSectionEditor.tsx
./app/admin/homepage/HeroSectionEditor.tsx
./app/admin/homepage/SaveButton.tsx
./app/admin/homepage/SectionList.tsx
./app/admin/homepage/StatsSectionEditor.tsx
./app/admin/homepage/SubPagesSectionEditor.tsx
./app/admin/homepage/page.tsx
./app/admin/homepage/types.ts
./app/admin/layout.tsx
./app/admin/lines/page.tsx
./app/admin/loading.tsx
./app/admin/order/page.tsx
./app/admin/orders/page.tsx
./app/admin/page.tsx
./app/admin/prices/page.tsx
./app/admin/products/ProductFilters.tsx
./app/admin/products/ProductForm.tsx
./app/admin/products/ProductTable.tsx
./app/admin/products/page.tsx
./app/admin/push/page.tsx
./app/admin/reviews/page.tsx
./app/admin/settings/page.tsx
./app/admin/website/page.tsx
./app/api/admin/ai-enhance/route.ts
./app/api/admin/ai-usage/route.ts
./app/api/admin/analytics/dashboard/route.ts
./app/api/admin/analytics/route.ts
./app/api/admin/categories/route.ts
./app/api/admin/commissions/analytics/route.ts
./app/api/admin/commissions/bridge/route.ts
./app/api/admin/commissions/calculate/route.ts
./app/api/admin/commissions/dashboard/route.ts
./app/api/admin/commissions/employees/list/route.ts
./app/api/admin/commissions/employees/route.ts
./app/api/admin/commissions/export/route.ts
./app/api/admin/commissions/profiles/route.ts
./app/api/admin/commissions/sales/route.ts
./app/api/admin/commissions/sanctions/route.ts
./app/api/admin/commissions/summary/route.ts
./app/api/admin/commissions/sync/route.ts
./app/api/admin/commissions/targets/route.ts
./app/api/admin/contact-notify/route.ts
./app/api/admin/coupons/route.ts
./app/api/admin/deals/route.ts
./app/api/admin/features/stats/route.ts
./app/api/admin/heroes/route.ts
./app/api/admin/image-enhance/route.ts
./app/api/admin/integrations/test/route.ts
./app/api/admin/lines/route.ts
./app/api/admin/order/route.ts
./app/api/admin/orders/[id]/history/route.ts
./app/api/admin/orders/create/route.ts
./app/api/admin/prices/apply/route.ts
./app/api/admin/prices/match-direct/route.ts
./app/api/admin/prices/match/route.ts
./app/api/admin/products/autofill/route.ts
./app/api/admin/products/bulk-color-images/route.ts
./app/api/admin/products/color-image/route.ts
./app/api/admin/products/distribute-stock/route.ts
./app/api/admin/products/export/route.ts
./app/api/admin/products/import-image/route.ts
./app/api/admin/products/pexels/route.ts
./app/api/admin/products/route.ts
./app/api/admin/reviews/generate/route.ts
./app/api/admin/sales-docs/[id]/reject/route.ts
./app/api/admin/sales-docs/[id]/verify/route.ts
./app/api/admin/sales-docs/route.ts
./app/api/admin/settings/route.ts
./app/api/admin/sub-pages/route.ts
./app/api/admin/supabase-management/route.ts
./app/api/admin/upload-logo/route.ts
./app/api/admin/upload/route.ts
./app/api/admin/website/route.ts
./app/api/admin/whatsapp-templates/route.ts
./app/api/admin/whatsapp-test/route.ts
./app/api/auth/change-password/route.ts
./app/api/auth/customer/route.ts
./app/api/cart/abandoned/route.ts
./app/api/chat/route.ts
./app/api/contact/route.ts
./app/api/coupons/validate/route.ts
./app/api/crm/chats/[id]/messages/route.ts
./app/api/crm/chats/route.ts
./app/api/crm/customers/[id]/360/route.ts
./app/api/crm/customers/[id]/hot-accounts/route.ts
./app/api/crm/customers/[id]/notes/route.ts
./app/api/crm/customers/[id]/route.ts
./app/api/crm/customers/export/route.ts
./app/api/crm/customers/reconcile/route.ts
./app/api/crm/customers/route.ts
./app/api/crm/dashboard/route.ts
./app/api/crm/inbox/[id]/assign/route.ts
./app/api/crm/inbox/[id]/auto-label/route.ts
./app/api/crm/inbox/[id]/notes/route.ts
./app/api/crm/inbox/[id]/recommend/route.ts
./app/api/crm/inbox/[id]/route.ts
./app/api/crm/inbox/[id]/send/route.ts
./app/api/crm/inbox/[id]/sentiment/route.ts
./app/api/crm/inbox/[id]/status/route.ts
./app/api/crm/inbox/[id]/suggest/route.ts
./app/api/crm/inbox/[id]/summary/route.ts
./app/api/crm/inbox/labels/route.ts
./app/api/crm/inbox/route.ts
./app/api/crm/inbox/stats/route.ts
./app/api/crm/inbox/templates/route.ts
./app/api/crm/inbox/upload/route.ts
./app/api/crm/orders/route.ts
./app/api/crm/pipeline/[id]/convert/route.ts
./app/api/crm/pipeline/route.ts
./app/api/crm/reports/route.ts
./app/api/crm/tasks/route.ts
./app/api/crm/users/route.ts
./app/api/cron/backup/route.ts
./app/api/cron/cleanup/route.ts
./app/api/cron/reports/route.ts
./app/api/csrf/route.ts
./app/api/customer/loyalty/route.ts
./app/api/customer/orders/route.ts
./app/api/customer/profile/route.ts
./app/api/email/route.ts
./app/api/health/route.ts
./app/api/notifications/route.ts
./app/api/orders/route.ts
./app/api/payment/callback/route.ts
./app/api/payment/route.ts
./app/api/payment/upay/callback/route.ts
./app/api/push/send/route.ts
./app/api/push/subscribe/route.ts
./app/api/push/vapid/route.ts
./app/api/pwa/customer-lookup/route.ts
./app/api/pwa/sales/[id]/attachments/route.ts
./app/api/pwa/sales/[id]/route.ts
./app/api/pwa/sales/[id]/submit/route.ts
./app/api/pwa/sales/route.ts
./app/api/reports/daily/route.ts
./app/api/reports/weekly/route.ts
./app/api/reviews/featured/route.ts
./app/api/reviews/route.ts
./app/api/settings/public/route.ts
./app/api/store/autocomplete/route.ts
./app/api/store/order-status/route.ts
./app/api/store/smart-search/route.ts
./app/api/webhook/twilio/route.ts
./app/api/webhook/whatsapp/route.ts
./app/change-password/page.tsx
./app/command-center/page.tsx
./app/contact/page.tsx
./app/crm/chats/page.tsx
./app/crm/customers/[id]/page.tsx
./app/crm/customers/page.tsx
./app/crm/error.tsx
./app/crm/inbox/page.tsx
./app/crm/layout.tsx
./app/crm/loading.tsx
./app/crm/orders/page.tsx
./app/crm/page.tsx
./app/crm/pipeline/page.tsx
./app/crm/reports/page.tsx
./app/crm/tasks/page.tsx
./app/crm/users/page.tsx
./app/deals/page.tsx
./app/error.tsx
./app/faq/page.tsx
./app/fonts.ts
./app/global-error.tsx
./app/layout.tsx
./app/legal/page.tsx
./app/loading.tsx
./app/m/inbox/[id]/page.tsx
./app/m/inbox/page.tsx
./app/m/layout.tsx
./app/not-found.tsx
./app/page.tsx
./app/privacy/page.tsx
./app/robots.ts
./app/sales-pwa/docs/[id]/page.tsx
./app/sales-pwa/layout.tsx
./app/sales-pwa/new/page.tsx
./app/sales-pwa/page.tsx
./app/sitemap.ts
./app/store/account/page.tsx
./app/store/auth/page.tsx
./app/store/cart/layout.tsx
./app/store/cart/page.tsx
./app/store/checkout/failed/page.tsx
./app/store/checkout/success/layout.tsx
./app/store/checkout/success/page.tsx
./app/store/compare/page.tsx
./app/store/contact/layout.tsx
./app/store/contact/page.tsx
./app/store/error.tsx
./app/store/layout.tsx
./app/store/loading.tsx
./app/store/page.tsx
./app/store/product/[id]/page.tsx
./app/store/track/layout.tsx
./app/store/track/page.tsx
./app/store/wishlist/layout.tsx
./app/store/wishlist/page.tsx
```

### `components/`
```
./components/CommandCenter.tsx
./components/admin/AdminShell.tsx
./components/admin/ImageUpload.tsx
./components/admin/charts/BarChart.tsx
./components/admin/charts/DonutChart.tsx
./components/admin/charts/LineChart.tsx
./components/admin/shared.tsx
./components/chat/WebChatWidget.tsx
./components/command-center/data.ts
./components/command-center/types.ts
./components/command-center/ui.tsx
./components/crm/CRMShell.tsx
./components/crm/OrdersManagementPage.tsx
./components/crm/inbox/AssignAgent.tsx
./components/crm/inbox/ChatPanel.tsx
./components/crm/inbox/ContactPanel.tsx
./components/crm/inbox/ConversationFilters.tsx
./components/crm/inbox/ConversationItem.tsx
./components/crm/inbox/ConversationList.tsx
./components/crm/inbox/InboxLayout.tsx
./components/crm/inbox/InboxStats.tsx
./components/crm/inbox/MessageBubble.tsx
./components/crm/inbox/MessageInput.tsx
./components/crm/inbox/NotesPanel.tsx
./components/crm/inbox/QuickReplies.tsx
./components/crm/inbox/TemplateSelector.tsx
./components/crm/inbox/index.ts
./components/mobile/MobileChat.tsx
./components/mobile/MobileHeader.tsx
./components/mobile/MobileInbox.tsx
./components/mobile/MobileMessageInput.tsx
./components/mobile/MobilePushInit.tsx
./components/orders/ManualOrderModal.tsx
./components/pwa/SalesPwaInit.tsx
./components/shared/Analytics.tsx
./components/shared/Analytics.tsx.bak
./components/shared/CookieConsent.tsx
./components/shared/LangSwitcher.tsx
./components/shared/Logo.tsx
./components/shared/PWAInstallPrompt.tsx
./components/shared/Providers.tsx
./components/store/CompareBar.tsx
./components/store/FloatingActions.tsx
./components/store/HeroCarousel.tsx
./components/store/LinePlans.tsx
./components/store/LoyaltyWidget.tsx
./components/store/ProductCard.tsx
./components/store/ProductDetail.tsx
./components/store/ProductReviews.tsx
./components/store/ReviewsSection.tsx
./components/store/SearchFilters.tsx
./components/store/SmartSearchBar.tsx
./components/store/StickyCartBar.tsx
./components/store/StoreClient.tsx
./components/store/StoreHeader.tsx
./components/store/cart/CartStep.tsx
./components/store/cart/ConfirmStep.tsx
./components/store/cart/StepBar.tsx
./components/store/index.ts
./components/ui/Toast.tsx
./components/website/HomeClient.tsx
./components/website/index.ts
./components/website/sections.tsx
```

### `lib/`
```
./lib/admin/ai-tools.ts
./lib/admin/auth.ts
./lib/admin/device-data.ts
./lib/admin/gsmarena.ts
./lib/admin/hooks.ts
./lib/admin/index.ts
./lib/admin/mobileapi.ts
./lib/admin/queries.ts
./lib/admin/validators.ts
./lib/ai/claude.ts
./lib/ai/gemini.ts
./lib/ai/product-context.ts
./lib/ai/usage-tracker.ts
./lib/analytics-events.ts
./lib/api-response.ts
./lib/auth.ts
./lib/bot/admin-notify.ts
./lib/bot/ai.ts
./lib/bot/analytics.ts
./lib/bot/engine.ts
./lib/bot/guardrails.ts
./lib/bot/handoff.ts
./lib/bot/index.ts
./lib/bot/intents.ts
./lib/bot/notifications.ts
./lib/bot/playbook.ts
./lib/bot/policies.ts
./lib/bot/templates.ts
./lib/bot/webchat.ts
./lib/bot/whatsapp.ts
./lib/brand-config.ts
./lib/brand-logos.ts
./lib/cities.ts
./lib/commissions/calculator.ts
./lib/commissions/crm-bridge.ts
./lib/commissions/ledger.ts
./lib/commissions/sync-orders.ts
./lib/constants.ts
./lib/crm/customer-timeline.ts
./lib/crm/inbox-types.ts
./lib/crm/inbox.ts
./lib/crm/index.ts
./lib/crm/pipeline.ts
./lib/crm/queries.ts
./lib/crm/realtime.ts
./lib/crm/sentiment.ts
./lib/crypto.ts
./lib/csrf-client.ts
./lib/csrf.ts
./lib/customer-auth.ts
./lib/email-templates.ts
./lib/hooks.ts
./lib/i18n.tsx
./lib/integrations/hub.ts
./lib/integrations/index.ts
./lib/integrations/removebg.ts
./lib/integrations/resend.ts
./lib/integrations/rivhit.ts
./lib/integrations/sendgrid.ts
./lib/integrations/twilio-sms.ts
./lib/integrations/upay.ts
./lib/integrations/ycloud-templates.ts
./lib/integrations/ycloud-wa.ts
./lib/loyalty.ts
./lib/notifications.ts
./lib/orders/admin.ts
./lib/payment-gateway.ts
./lib/pdf-export.ts
./lib/public-site-url.ts
./lib/pwa/auth.ts
./lib/pwa/customer-linking.ts
./lib/pwa/validators.ts
./lib/rate-limit-db.ts
./lib/rate-limit.ts
./lib/reports/service.ts
./lib/seo.ts
./lib/storage-r2.ts
./lib/storage.ts
./lib/store/cart.ts
./lib/store/compare.ts
./lib/store/index.ts
./lib/store/queries.ts
./lib/store/wishlist.ts
./lib/supabase-management.ts
./lib/supabase.ts
./lib/utils.ts
./lib/validators.ts
./lib/webhook-verify.ts
```

### `types/`
```
./types/database.ts
```

### `supabase/`
```
./supabase/.temp/cli-latest
./supabase/.temp/gotrue-version
./supabase/.temp/pooler-url
./supabase/.temp/postgres-version
./supabase/.temp/project-ref
./supabase/.temp/rest-version
./supabase/.temp/storage-migration
./supabase/.temp/storage-version
./supabase/migrations/20260101000001_initial_schema.sql
./supabase/migrations/20260101000002_functions.sql
./supabase/migrations/20260101000003_bot_tables.sql
./supabase/migrations/20260101000004_bot_fixes.sql
./supabase/migrations/20260101000005_features.sql
./supabase/migrations/20260101000006_customer_auth.sql
./supabase/migrations/20260101000007_inbox.sql
./supabase/migrations/20260101000008_ai_enhancement.sql
./supabase/migrations/20260101000009_product_variants_and_cms.sql
./supabase/migrations/20260101000010_populate_product_variants.sql
./supabase/migrations/20260101000011_fix_product_colors.sql
./supabase/migrations/20260101000012_product_name_en.sql
./supabase/migrations/20260101000013_reset_stocks.sql
./supabase/migrations/20260101000014_sub_pages.sql
./supabase/migrations/20260101000015_template_usage_rpc.sql
./supabase/migrations/20260101000016_whatsapp_templates.sql
./supabase/migrations/20260101000017_tighten_rls_policies.sql
./supabase/migrations/20260101000018_add_integration_types.sql
./supabase/migrations/20260101000019_user_management.sql
./supabase/migrations/20260101000020_rate_limits.sql
./supabase/migrations/20260101000021_atomic_order_and_rls_fix.sql
./supabase/migrations/20260101000022_order_status_alignment.sql
./supabase/migrations/20260101000023_stock_coupon_integrity.sql
./supabase/migrations/20260101000024_performance_indexes.sql
./supabase/migrations/20260101000025_commissions.sql
./supabase/migrations/20260101000026_commissions_lock_and_analytics.sql
./supabase/migrations/20260101000027_employee_commission_profiles.sql
./supabase/migrations/20260101000028_team_commissions.sql
./supabase/migrations/20260101000029_commission_employees.sql
./supabase/migrations/20260101000030_commission_soft_delete.sql
./supabase/migrations/20260311000001_loyalty.sql
./supabase/migrations/20260311000002_notifications.sql
./supabase/migrations/20260406000001_employee_unification.sql
./supabase/migrations/20260406000002_rbac_permissions.sql
./supabase/migrations/20260407000001_order_management_pipeline.sql
./supabase/migrations/20260407000002_soft_delete.sql
./supabase/migrations/20260407000003_payment_callback_rpc.sql
./supabase/migrations/20260408000001_customer_management_360.sql
./supabase/migrations/20260410000001_sales_docs_pwa.sql
./supabase/migrations/20260411000001_customer_identity.sql
./supabase/migrations/20260411000002_commission_customer_link.sql
./supabase/migrations/20260411000003_sales_docs_customer_fk_and_commission_backfill.sql
./supabase/migrations/20260412000001_commission_identity_enrichment.sql
./supabase/seed/seed.sql
./supabase/seed/update_images.sql
./supabase/update-products.sql
```

## 5. 🔌 API Routes

```
  /admin/ai-enhance/route.ts  [POST]
  /admin/ai-usage/route.ts  [GET]
  /admin/analytics/dashboard/route.ts  [GET]
  /admin/analytics/route.ts  [GET]
  /admin/categories/route.ts  [DELETE,GET,POST,PUT]
  /admin/commissions/analytics/route.ts  [GET]
  /admin/commissions/bridge/route.ts  [GET]
  /admin/commissions/calculate/route.ts  [POST]
  /admin/commissions/dashboard/route.ts  [GET]
  /admin/commissions/employees/list/route.ts  [GET]
  /admin/commissions/employees/route.ts  [DELETE,GET,PATCH,POST]
  /admin/commissions/export/route.ts  [GET]
  /admin/commissions/profiles/route.ts  [DELETE,GET,POST]
  /admin/commissions/sales/route.ts  [DELETE,GET,POST,PUT]
  /admin/commissions/sanctions/route.ts  [DELETE,GET,POST]
  /admin/commissions/summary/route.ts  [GET]
  /admin/commissions/sync/route.ts  [GET,POST]
  /admin/commissions/targets/route.ts  [GET,PATCH,POST]
  /admin/contact-notify/route.ts  [POST]
  /admin/coupons/route.ts  [DELETE,GET,POST,PUT]
  /admin/deals/route.ts  [DELETE,GET,POST,PUT]
  /admin/features/stats/route.ts  [GET]
  /admin/heroes/route.ts  [DELETE,GET,POST,PUT]
  /admin/image-enhance/route.ts  [POST]
  /admin/integrations/test/route.ts  [POST]
  /admin/lines/route.ts  [DELETE,GET,POST,PUT]
  /admin/order/route.ts  [GET,PUT]
  /admin/orders/[id]/history/route.ts  [GET]
  /admin/orders/create/route.ts  [POST]
  /admin/prices/apply/route.ts  [POST]
  /admin/prices/match-direct/route.ts  [POST]
  /admin/prices/match/route.ts  [POST]
  /admin/products/autofill/route.ts  [POST]
  /admin/products/bulk-color-images/route.ts  [POST]
  /admin/products/color-image/route.ts  [POST]
  /admin/products/distribute-stock/route.ts  [POST]
  /admin/products/export/route.ts  [GET]
  /admin/products/import-image/route.ts  [POST]
  /admin/products/pexels/route.ts  [POST]
  /admin/products/route.ts  [DELETE,GET,POST,PUT]
  /admin/reviews/generate/route.ts  [POST]
  /admin/sales-docs/[id]/reject/route.ts  [POST]
  /admin/sales-docs/[id]/verify/route.ts  [POST]
  /admin/sales-docs/route.ts  [GET]
  /admin/settings/route.ts  [GET,PUT]
  /admin/sub-pages/route.ts  [DELETE,GET,POST,PUT]
  /admin/supabase-management/route.ts  [GET,POST]
  /admin/upload-logo/route.ts  [DELETE,POST]
  /admin/upload/route.ts  [POST]
  /admin/website/route.ts  [GET,PUT]
  /admin/whatsapp-templates/route.ts  [DELETE,GET,POST]
  /admin/whatsapp-test/route.ts  [POST]
  /auth/change-password/route.ts  [POST]
  /auth/customer/route.ts  [POST]
  /cart/abandoned/route.ts  [DELETE,POST]
  /chat/route.ts  [POST]
  /contact/route.ts  [POST]
  /coupons/validate/route.ts  [POST]
  /crm/chats/[id]/messages/route.ts  [GET,PUT]
  /crm/chats/route.ts  [GET]
  /crm/customers/[id]/360/route.ts  [GET]
  /crm/customers/[id]/hot-accounts/route.ts  [DELETE,GET,POST,PUT]
  /crm/customers/[id]/notes/route.ts  [GET,POST]
  /crm/customers/[id]/route.ts  [DELETE,GET,PUT]
  /crm/customers/export/route.ts  [GET]
  /crm/customers/reconcile/route.ts  [POST]
  /crm/customers/route.ts  [GET,POST]
  /crm/dashboard/route.ts  [GET]
  /crm/inbox/[id]/assign/route.ts  [PUT]
  /crm/inbox/[id]/auto-label/route.ts  [POST]
  /crm/inbox/[id]/notes/route.ts  [GET,POST]
  /crm/inbox/[id]/recommend/route.ts  [POST]
  /crm/inbox/[id]/route.ts  [GET]
  /crm/inbox/[id]/send/route.ts  [POST]
  /crm/inbox/[id]/sentiment/route.ts  [POST]
  /crm/inbox/[id]/status/route.ts  [PUT]
  /crm/inbox/[id]/suggest/route.ts  [POST]
  /crm/inbox/[id]/summary/route.ts  [POST]
  /crm/inbox/labels/route.ts  [DELETE,GET,POST,PUT]
  /crm/inbox/route.ts  [GET]
  /crm/inbox/stats/route.ts  [GET]
  /crm/inbox/templates/route.ts  [DELETE,GET,POST,PUT]
  /crm/inbox/upload/route.ts  [POST]
  /crm/orders/route.ts  [GET,PUT]
  /crm/pipeline/[id]/convert/route.ts  [POST]
  /crm/pipeline/route.ts  [DELETE,GET,POST,PUT]
  /crm/reports/route.ts  [GET]
  /crm/tasks/route.ts  [DELETE,GET,POST,PUT]
  /crm/users/route.ts  [DELETE,GET,POST,PUT]
  /cron/backup/route.ts  [POST]
  /cron/cleanup/route.ts  [POST]
  /cron/reports/route.ts  [GET,POST]
  /csrf/route.ts  [GET]
  /customer/loyalty/route.ts  [GET,POST]
  /customer/orders/route.ts  [GET]
  /customer/profile/route.ts  [GET,PUT]
  /email/route.ts  [POST]
  /health/route.ts  [GET]
  /notifications/route.ts  [GET,PATCH,POST]
  /orders/route.ts  [POST]
  /payment/callback/route.ts  [GET,POST]
  /payment/route.ts  [POST]
  /payment/upay/callback/route.ts  [GET]
  /push/send/route.ts  [GET,POST]
  /push/subscribe/route.ts  [DELETE,POST]
  /push/vapid/route.ts  [GET]
  /pwa/customer-lookup/route.ts  [GET]
  /pwa/sales/[id]/attachments/route.ts  [POST]
  /pwa/sales/[id]/route.ts  [GET,PUT]
  /pwa/sales/[id]/submit/route.ts  [POST]
  /pwa/sales/route.ts  [GET,POST]
  /reports/daily/route.ts  [GET]
  /reports/weekly/route.ts  [GET]
  /reviews/featured/route.ts  [GET]
  /reviews/route.ts  [DELETE,GET,POST,PUT]
  /settings/public/route.ts  [GET]
  /store/autocomplete/route.ts  [GET]
  /store/order-status/route.ts  [GET]
  /store/smart-search/route.ts  [GET]
  /webhook/twilio/route.ts  [GET,POST]
  /webhook/whatsapp/route.ts  [GET,POST]
```

## 6. 🗄️ Database Schema

### Migration Files
```
./.claude/worktrees/nifty-hopper/supabase/migrations/001_initial_schema.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/002_functions.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/003_bot_tables.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/004_bot_fixes.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/005_features.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/006_customer_auth.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/007_inbox.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/008_ai_enhancement.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/009_product_variants_and_cms.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/010_populate_product_variants.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/011_fix_product_colors.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/012_product_name_en.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/013_reset_stocks.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/014_sub_pages.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/015_template_usage_rpc.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/016_whatsapp_templates.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/017_tighten_rls_policies.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/018_add_integration_types.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/019_user_management.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/020_rate_limits.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/021_atomic_order_and_rls_fix.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/022_order_status_alignment.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/023_stock_coupon_integrity.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/024_performance_indexes.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/025_commissions.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/026_commissions_lock_and_analytics.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/027_team_commissions.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/20260311_loyalty.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/20260311_notifications.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/20260411000001_customer_retention_phase1.sql
./.claude/worktrees/nifty-hopper/supabase/migrations/20260411000002_commissions_identity.sql
./supabase/migrations/20260101000001_initial_schema.sql
./supabase/migrations/20260101000002_functions.sql
./supabase/migrations/20260101000003_bot_tables.sql
./supabase/migrations/20260101000004_bot_fixes.sql
./supabase/migrations/20260101000005_features.sql
./supabase/migrations/20260101000006_customer_auth.sql
./supabase/migrations/20260101000007_inbox.sql
./supabase/migrations/20260101000008_ai_enhancement.sql
./supabase/migrations/20260101000009_product_variants_and_cms.sql
./supabase/migrations/20260101000010_populate_product_variants.sql
./supabase/migrations/20260101000011_fix_product_colors.sql
./supabase/migrations/20260101000012_product_name_en.sql
./supabase/migrations/20260101000013_reset_stocks.sql
./supabase/migrations/20260101000014_sub_pages.sql
./supabase/migrations/20260101000015_template_usage_rpc.sql
./supabase/migrations/20260101000016_whatsapp_templates.sql
./supabase/migrations/20260101000017_tighten_rls_policies.sql
./supabase/migrations/20260101000018_add_integration_types.sql
./supabase/migrations/20260101000019_user_management.sql
./supabase/migrations/20260101000020_rate_limits.sql
./supabase/migrations/20260101000021_atomic_order_and_rls_fix.sql
./supabase/migrations/20260101000022_order_status_alignment.sql
./supabase/migrations/20260101000023_stock_coupon_integrity.sql
./supabase/migrations/20260101000024_performance_indexes.sql
./supabase/migrations/20260101000025_commissions.sql
./supabase/migrations/20260101000026_commissions_lock_and_analytics.sql
./supabase/migrations/20260101000027_employee_commission_profiles.sql
./supabase/migrations/20260101000028_team_commissions.sql
./supabase/migrations/20260101000029_commission_employees.sql
./supabase/migrations/20260101000030_commission_soft_delete.sql
./supabase/migrations/20260311000001_loyalty.sql
./supabase/migrations/20260311000002_notifications.sql
./supabase/migrations/20260406000001_employee_unification.sql
./supabase/migrations/20260406000002_rbac_permissions.sql
./supabase/migrations/20260407000001_order_management_pipeline.sql
./supabase/migrations/20260407000002_soft_delete.sql
./supabase/migrations/20260407000003_payment_callback_rpc.sql
./supabase/migrations/20260408000001_customer_management_360.sql
./supabase/migrations/20260410000001_sales_docs_pwa.sql
./supabase/migrations/20260411000001_customer_identity.sql
./supabase/migrations/20260411000002_commission_customer_link.sql
./supabase/migrations/20260411000003_sales_docs_customer_fk_and_commission_backfill.sql
./supabase/migrations/20260412000001_commission_identity_enrichment.sql
```

### Tables (extracted from migrations)
```
abandoned_carts
ai_usage
audit_log
bot_analytics
bot_conversations
bot_handoffs
bot_messages
bot_policies
bot_templates
categories
commission_employees
commission_sales
commission_sanctions
commission_sync_log
commission_targets
coupons
customer_hot_accounts
customer_notes
customer_otps
customers
deals
email_templates
employee_commission_profiles
heroes
inbox_conversation_labels
inbox_conversations
inbox_events
inbox_labels
inbox_messages
inbox_notes
inbox_quick_replies
inbox_templates
integrations
line_plans
loyalty_points
loyalty_transactions
notifications
order_items
order_notes
order_status_history
orders
permissions
pipeline_deals
pipeline_stages
product_reviews
products
push_notifications
push_subscriptions
rate_limits
role_permissions
sales_doc_attachments
sales_doc_events
sales_doc_items
sales_doc_sync_queue
sales_docs
settings
sub_pages
tasks
users
website_content
```

### ⚠️ Migration Health Check
**DUPLICATE MIGRATION NUMBERS DETECTED:**
```
20260311
20260411000001
20260411000002
```

## 7. 🧩 Components

```
  CommandCenter.tsx  (904L)
  admin/AdminShell.tsx  (104L)
  admin/ImageUpload.tsx  (234L)
  admin/charts/BarChart.tsx  (83L)
  admin/charts/DonutChart.tsx  (149L)
  admin/charts/LineChart.tsx  (169L)
  admin/shared.tsx  (194L)
  chat/WebChatWidget.tsx  (314L)
  command-center/ui.tsx  (85L)
  crm/CRMShell.tsx  (73L)
  crm/OrdersManagementPage.tsx  (559L)
  crm/inbox/AssignAgent.tsx  (111L)
  crm/inbox/ChatPanel.tsx  (382L)
  crm/inbox/ContactPanel.tsx  (311L)
  crm/inbox/ConversationFilters.tsx  (135L)
  crm/inbox/ConversationItem.tsx  (113L)
  crm/inbox/ConversationList.tsx  (101L)
  crm/inbox/InboxLayout.tsx  (208L)
  crm/inbox/InboxStats.tsx  (36L)
  crm/inbox/MessageBubble.tsx  (218L)
  crm/inbox/MessageInput.tsx  (353L)
  crm/inbox/NotesPanel.tsx  (83L)
  crm/inbox/QuickReplies.tsx  (79L)
  crm/inbox/TemplateSelector.tsx  (167L)
  mobile/MobileChat.tsx  (258L)
  mobile/MobileHeader.tsx  (110L)
  mobile/MobileInbox.tsx  (215L)
  mobile/MobileMessageInput.tsx  (373L)
  mobile/MobilePushInit.tsx  (115L)
  orders/ManualOrderModal.tsx  (446L)
  pwa/SalesPwaInit.tsx  (13L)
  shared/Analytics.tsx  (178L)
  shared/CookieConsent.tsx  (71L)
  shared/LangSwitcher.tsx  (78L)
  shared/Logo.tsx  (151L)
  shared/PWAInstallPrompt.tsx  (293L)
  shared/Providers.tsx  (7L)
  store/CompareBar.tsx  (111L)
  store/FloatingActions.tsx  (32L)
  store/HeroCarousel.tsx  (105L)
  store/LinePlans.tsx  (77L)
  store/LoyaltyWidget.tsx  (381L)
  store/ProductCard.tsx  (486L)
  store/ProductDetail.tsx  (377L)
  store/ProductReviews.tsx  (235L)
  store/ReviewsSection.tsx  (92L)
  store/SearchFilters.tsx  (602L)
  store/SmartSearchBar.tsx  (594L)
  store/StickyCartBar.tsx  (90L)
  store/StoreClient.tsx  (270L)
  store/StoreHeader.tsx  (186L)
  store/cart/CartStep.tsx  (145L)
  store/cart/ConfirmStep.tsx  (115L)
  store/cart/StepBar.tsx  (37L)
  ui/Toast.tsx  (32L)
  website/HomeClient.tsx  (22L)
  website/sections.tsx  (424L)
```

## 8. 📐 TypeScript Types

```
  ./.claude/worktrees/nifty-hopper/next-env.d.ts  (6L)
  ./.open-next/cloudflare-templates/images.d.ts  (85L)
    → export type RemotePattern
    → export type LocalPattern
    → export type OptimizedImageFormat
    → type ErrorResult
    → type ImageContentType
    → type NextConfigImageFormat
  ./.open-next/cloudflare-templates/init.d.ts  (16L)
  ./.open-next/cloudflare-templates/shims/empty.d.ts  (2L)
  ./.open-next/cloudflare-templates/shims/env.d.ts  (1L)
  ./.open-next/cloudflare-templates/shims/fetch.d.ts  (1L)
  ./.open-next/cloudflare-templates/shims/throw.d.ts  (2L)
  ./.open-next/cloudflare-templates/skew-protection.d.ts  (28L)
  ./.open-next/cloudflare-templates/worker.d.ts  (7L)
  ./app/admin/homepage/types.ts  (21L)
    → export type EditorProps
  ./components/command-center/types.ts  (40L)
    → export interface CRMData
    → export interface InboxData
    → export interface TaskItem
    → export interface AnalyticsData
    → export interface TxItem
    → export interface ExpenseItem
    → export interface MonthlyRow
    → export interface RevenueStream
  ./global.d.ts  (1L)
  ./next-env.d.ts  (6L)
```

## 9. 🏪 Zustand Stores

```
  .claude/worktrees/nifty-hopper/.next/types/app/api/store/autocomplete/route.ts  (347L)
  .claude/worktrees/nifty-hopper/.next/types/app/api/store/order-status/route.ts  (347L)
  .claude/worktrees/nifty-hopper/.next/types/app/api/store/smart-search/route.ts  (347L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/account/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/auth/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/cart/layout.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/cart/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/checkout/failed/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/checkout/success/layout.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/checkout/success/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/compare/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/contact/layout.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/contact/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/product/[id]/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/track/layout.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/track/page.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/wishlist/layout.ts  (84L)
  .claude/worktrees/nifty-hopper/.next/types/app/store/wishlist/page.ts  (84L)
  .claude/worktrees/nifty-hopper/app/api/store/autocomplete/route.ts  (76L)
  .claude/worktrees/nifty-hopper/app/api/store/order-status/route.ts  (40L)
  .claude/worktrees/nifty-hopper/app/api/store/smart-search/route.ts  (244L)
  .claude/worktrees/nifty-hopper/components/store/index.ts  (6L)
  .claude/worktrees/nifty-hopper/lib/store/cart.ts  (159L)
    → uses: create<
  .claude/worktrees/nifty-hopper/lib/store/compare.ts  (108L)
    → uses: create<
  .claude/worktrees/nifty-hopper/lib/store/index.ts  (15L)
  .claude/worktrees/nifty-hopper/lib/store/queries.ts  (188L)
  .claude/worktrees/nifty-hopper/lib/store/wishlist.ts  (115L)
    → uses: create<
  .next/types/app/api/store/autocomplete/route.ts  (347L)
  .next/types/app/api/store/order-status/route.ts  (347L)
  .next/types/app/api/store/smart-search/route.ts  (347L)
  .next/types/app/store/account/page.ts  (84L)
  .next/types/app/store/auth/page.ts  (84L)
  .next/types/app/store/cart/layout.ts  (84L)
  .next/types/app/store/cart/page.ts  (84L)
  .next/types/app/store/checkout/failed/page.ts  (84L)
  .next/types/app/store/checkout/success/layout.ts  (84L)
  .next/types/app/store/checkout/success/page.ts  (84L)
  .next/types/app/store/compare/page.ts  (84L)
  .next/types/app/store/contact/layout.ts  (84L)
  .next/types/app/store/contact/page.ts  (84L)
  .next/types/app/store/page.ts  (84L)
  .next/types/app/store/product/[id]/page.ts  (84L)
  .next/types/app/store/track/layout.ts  (84L)
  .next/types/app/store/track/page.ts  (84L)
  .next/types/app/store/wishlist/layout.ts  (84L)
  .next/types/app/store/wishlist/page.ts  (84L)
  app/api/store/autocomplete/route.ts  (78L)
  app/api/store/order-status/route.ts  (40L)
  app/api/store/smart-search/route.ts  (244L)
  components/store/index.ts  (6L)
  lib/store/cart.ts  (175L)
    → uses: create<
  lib/store/compare.ts  (108L)
    → uses: create<
  lib/store/index.ts  (15L)
  lib/store/queries.ts  (168L)
  lib/store/wishlist.ts  (115L)
    → uses: create<
```


## 10. 📊 Season Progress

| Season | Scope | Status | Key Deliverables |
|--------|-------|--------|-----------------|
| S0 | Infrastructure | ⏳ Next | Foundation, CI/CD, testing setup |
| S1 | Store/E-commerce | ✅ Complete | Product pages, cart, checkout |
| S2 | Admin Panel | ✅ Complete | Dashboard, products, Integration Hub (6 providers) |
| S3 | CRM | 🔄 ~75% | WhatsApp Inbox, AI replies, sentiment, RAG |
| S4 | AI Chatbots | ⏳ Not started | WhatsApp bot, WebChat |

## 11. ⚠️ Known Issues (Must Fix)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | Duplicate migration #011 | 🔴 High | Two files with number 011 — will fail in production |
| 2 | Permissive RLS on sub_pages | 🔴 High | `USING(true)` — no real access control |
| 3 | Missing error.tsx boundaries | 🟡 Medium | Route segments lack error boundaries |
| 4 | Single oversized types file | 🟡 Medium | Should be split per domain |
| 5 | No ESLint/Prettier config | 🟡 Medium | Code style not enforced |
| 6 | legacy-peer-deps workaround | 🟡 Medium | npm install uses --legacy-peer-deps |

## 12. 🧪 Test Planning Reference

Use sections 5-9 above to plan tests:
- **API Routes** (Section 5) → Integration tests for each endpoint
- **Database** (Section 6) → Migration tests, RLS policy tests
- **Components** (Section 7) → Unit tests with React Testing Library
- **Types** (Section 8) → Type-level tests with tsd or expect-type
- **Stores** (Section 9) → Zustand store unit tests

### Recommended test structure:
```
__tests__/
├── unit/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── utils/
├── integration/
│   ├── api/
│   └── db/
└── e2e/
    ├── store/
    ├── admin/
    └── crm/
```


## 13. 📦 Dependencies Summary

### Dependencies
```
  "dependencies": {
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.100.1",
    "clsx": "^2.1.0",
    "lucide-react": "^0.400.0",
    "next": "^15.5.14",
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^5.5.207",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "recharts": "^3.8.1",
    "tailwind-merge": "^2.4.0",
    "xlsx": "^0.18.5",
    "zod": "^4.3.6",
    "zustand": "^4.5.0"
  },
```

### Dev Dependencies
```
  "devDependencies": {
    "@opennextjs/cloudflare": "^1.18.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^5.1.4",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.39.4",
    "eslint-config-next": "^16.2.1",
    "jsdom": "^28.1.0",
    "postcss": "^8.4.0",
    "postgres": "^3.4.8",
    "prettier": "^3.8.1",
    "prettier-plugin-tailwindcss": "^0.7.2",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^4.0.18",
    "wrangler": "^4.78.0"
  }
```

## 14. 🔑 Environment Variables

### From `.env.example`
```
NEXT_PUBLIC_SUPABASE_URL=***
NEXT_PUBLIC_SUPABASE_ANON_KEY=***
SUPABASE_SERVICE_ROLE_KEY=***
SUPABASE_ACCESS_TOKEN=***
SUPABASE_PROJECT_REF=***
DATABASE_URL=***
NEXT_PUBLIC_APP_URL=***
NEXT_PUBLIC_SITE_URL=***
ANTHROPIC_API_KEY=***
ANTHROPIC_API_KEY_ADMIN=***
ANTHROPIC_API_KEY_BOT=***
ANTHROPIC_API_KEY_STORE=***
OPENAI_API_KEY=***
OPENAI_API_KEY_ADMIN=***
OPENAI_API_KEY_PRICES=***
GEMINI_API_KEY=***
ICREDIT_GROUP_PRIVATE_TOKEN=***
ICREDIT_TEST_MODE=***
RIVHIT_API_KEY=***
UPAY_API_KEY=***
UPAY_API_USERNAME=***
PAYMENT_WEBHOOK_SECRET=***
YCLOUD_API_KEY=***
WHATSAPP_PHONE_ID=***
WEBHOOK_SECRET=***
WEBHOOK_VERIFY_TOKEN=***
TWILIO_ACCOUNT_SID=***
TWILIO_AUTH_TOKEN=***
TWILIO_FROM_NUMBER=***
TWILIO_MESSAGING_SERVICE_SID=***
TWILIO_VERIFY_SERVICE_SID=***
SENDGRID_API_KEY=***
SENDGRID_FROM=***
RESEND_API_KEY=***
RESEND_FROM=***
R2_ACCESS_KEY_ID=***
R2_SECRET_ACCESS_KEY=***
R2_ACCOUNT_ID=***
R2_BUCKET_NAME=***
R2_PUBLIC_URL=***
NEXT_PUBLIC_VAPID_PUBLIC_KEY=***
VAPID_PRIVATE_KEY=***
VAPID_SUBJECT=***
REMOVEBG_API_KEY=***
PEXELS_API_KEY=***
MOBILEAPI_KEY=***
COMMISSION_API_TOKEN=***
COMMISSION_ALLOWED_ORIGINS=***
CRON_SECRET=***
CONTACT_EMAIL=***
ADMIN_PERSONAL_PHONE=***
TEAM_WHATSAPP_NUMBERS=***
MOBILEAPI_KEY=***
SUPABASE_ACCESS_TOKEN=***
COMMISSION_API_TOKEN=***
```
### Environment variables referenced in code
```
ADMIN_PERSONAL_PHONE
ALIYUN_REGION_ID
ANTHROPIC_API_KEY
ANTHROPIC_API_KEY_ADMIN
ANTHROPIC_API_KEY_BOT
ANTHROPIC_API_KEY_STORE
APPDATA
ARM_VERSION
AUTOPREFIXER_GRID
AWS_ACCESS_KEY_ID
AWS_DEFAULT_REGION
AWS_EXECUTION_ENV
AWS_LAMBDA_BENCHMARK_MODE
AWS_LOGIN_CACHE_DIRECTORY
AWS_REGION
AWS_SDK_DYNAMODB_MAX_ATTEMPTS
AWS_SDK_S
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
BABEL_ENV
BABEL_SHOW_CONFIG_FOR
BABEL_TYPES_
BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA
BLAKE
BOOK_LANG
BROTLI_QUALITY
BROWSER
BROWSERSLIST
BROWSERSLIST_CONFIG
BROWSERSLIST_DANGEROUS_EXTEND
BROWSERSLIST_DISABLE_CACHE
BROWSERSLIST_ENV
BROWSERSLIST_IGNORE_OLD_DATA
BROWSERSLIST_ROOT_PATH
BROWSERSLIST_STATS
BROWSERSLIST_TRACE_WARNING
BROWSER_ARGS
BUCKET_REGION
BUILTIN_APP_LOADER
BUILTIN_FLIGHT_CLIENT_ENTRY_PLUGIN
BUILTIN_SWC_LOADER
CACHE_DYNAMO_TABLE
CF_ACCOUNT_ID
CF_PAGES_COMMIT_SHA
CF_PAGES_UPLOAD_JWT
CF_PREVIEW_DOMAIN
CF_WORKER_NAME
CHOKIDAR_INTERVAL
CHOKIDAR_PRINT_FSEVENTS_REQUIRE_ERROR
CHOKIDAR_USEPOLLING
CI
CIRCLE_NODE_TOTAL
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_CONTAINER_REGISTRY
CLOUDFRONT_DISTRIBUTION_ID
COLORTERM
COLUMNS
COMMISSION_ALLOWED_ORIGINS
COMMISSION_API_TOKEN
COMMIT_REF
COMPUTERNAME
CONTACT_EMAIL
CRITTERS_LOG_LEVEL
CRON_SECRET
CSS_CHUNKING_SUMMARY
DATABASE_URL
DEBUG
DEBUG_DISABLE_SOURCE_MAP
DEBUG_MIME
DEBUG_NOPT
DEBUG_VITE_SOURCEMAP_COMBINE_FILTER
DEPLOYMENT_ID
DEV
DISABLE_CACHE
DISABLE_SYSTEM_FONTS_LOAD
DOCKER_HOST
DOTENV_CONFIG_DEBUG
DOTENV_CONFIG_DOTENV_KEY
DOTENV_CONFIG_ENCODING
DOTENV_CONFIG_OVERRIDE
DOTENV_CONFIG_PATH
DOTENV_CONFIG_QUIET
DOTENV_KEY
DOTENV_PRIVATE_KEY
DOTENV_PRIVATE_KEY_
DYNAMO_BATCH_WRITE_COMMAND_CONCURRENCY
DYNO
EDITOR
ELECTRON_RUN_AS_NODE
EMULATE_VERCEL_REQUEST_CONTEXT
ESBUILD_BINARY_PATH
ESBUILD_MAX_BUFFER
ESBUILD_WORKER_THREADS
ESLINT_FLAGS
ESLINT_USE_FLAT_CONFIG
EXPERIMENTAL_DEBUG_MEMORY_USAGE
EXPERIMENTAL_MIDDLEWARE
FIGMA_PERSONAL_ACCESS_TOKEN
FLY_REGION
FORCE_COLOR
GCP_PROJECT
GEMINI_API_KEY
GITHUB_ACTIONS
GITHUB_SHA
GRACEFUL_FS_PLATFORM
HADOOP_HOME
HEALTH_CHECK_TOKEN
HELLO
HOME
HOMEDRIVE
HOMEPATH
HOST
HOSTNAME
HTTPS_PROXY
HTTP_PROXY
IBM_CLOUD_REGION
ICEBERG_TOKEN
ICREDIT_GROUP_PRIVATE_TOKEN
ICREDIT_TEST_MODE
IDE
IGNORE_TEST_WIN
IS_NEXT_WORKER
IS_TURBOPACK_TEST
JEST_WORKER_ID
JITI_ALIAS
JITI_CACHE
JITI_DEBUG
JITI_ESM_RESOLVE
JITI_EXPERIMENTAL_BUN
JITI_NATIVE_MODULES
JITI_REQUIRE_CACHE
JITI_RESPECT_TMPDIR_ENV
JITI_SOURCE_MAPS
JITI_TRANSFORM_MODULES
KEEP_ALIVE_TIMEOUT
LAMBDA_TASK_ROOT
LANG
LAUNCH_EDITOR
LC_ALL
LC_CTYPE
LIBC
LNAME
LOCALAPPDATA
LOGNAME
LOG_STREAM
LOG_TOKENS
MAX_REVALIDATE_CONCURRENCY
MINIFLARE_ASSERT_BODIES_CONSUMED
MINIFLARE_CACHE_DIR
MINIFLARE_CONTAINER_EGRESS_IMAGE
MINIFLARE_REGISTRY_PATH
MINIFLARE_WORKERD_CONFIG_DEBUG
MINIFLARE_WORKERD_PATH
MOBILEAPI_KEY
NAPI_RS_FORCE_WASI
NAPI_RS_NATIVE_LIBRARY_PATH
NETLIFY
NETLIFY_ANGULAR_PLUGIN_SKIP
NETLIFY_NEXT_PLUGIN_SKIP
NETLIFY_SKIP_GATSBY_BUILD_PLUGIN
NEXTJS_ENV
NEXT_ADAPTER_PATH
NEXT_BUILD_ID
NEXT_CACHE_HANDLER_PATH
NEXT_COMPILER_NAME
NEXT_CPU_PROF
NEXT_DEBUG_BUILD
NEXT_DEBUG_IMMEDIATES
NEXT_DEBUG_MINIFY
NEXT_DEFAULT_CACHE_HANDLER_PATH
NEXT_DEPLOYMENT_ID
NEXT_DEV_WRANGLER_ENV
NEXT_DISABLE_MEM_OVERRIDE
NEXT_DISABLE_SWC_WASM
NEXT_EDGE_RUNTIME_PROVIDER
NEXT_EXIT_TIMEOUT_MS
NEXT_FONT_GOOGLE_MOCKED_RESPONSES
NEXT_IGNORE_INCORRECT_LOCKFILE
NEXT_IS_EXPORT_WORKER
NEXT_MANUAL_SIG_HANDLE
NEXT_MINIMAL
NEXT_OTEL_FETCH_DISABLED
NEXT_OTEL_PERFORMANCE_PREFIX
NEXT_OTEL_VERBOSE
NEXT_PHASE
NEXT_PREVIEW_MODE_ID
NEXT_PRIVATE_APP_PATHS
NEXT_PRIVATE_BUILD_WORKER
NEXT_PRIVATE_CDN_CONSUMED_SWR_CACHE_CONTROL
NEXT_PRIVATE_DEBUG_CACHE
NEXT_PRIVATE_DEBUG_VALIDATION
NEXT_PRIVATE_DEV_DIR
NEXT_PRIVATE_LOCAL_DEV
NEXT_PRIVATE_LOCAL_WEBPACK
NEXT_PRIVATE_MINIMAL_MODE
NEXT_PRIVATE_OUTPUT_TRACE_ROOT
NEXT_PRIVATE_PAGE_PATHS
NEXT_PRIVATE_RESPONSE_CACHE_MAX_SIZE
NEXT_PRIVATE_RESPONSE_CACHE_TTL
NEXT_PRIVATE_STANDALONE
NEXT_PRIVATE_TEST_HEADERS
NEXT_PRIVATE_TEST_PROXY
NEXT_PRIVATE_TRACE_ID
NEXT_PRIVATE_WORKER
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
NEXT_REMOTE_CACHE_HANDLER_PATH
NEXT_RSPACK
NEXT_RUNTIME
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
NEXT_SSG_FETCH_METRICS
NEXT_STATIC_CACHE_HANDLER_PATH
NEXT_TELEMETRY_DISABLED
NEXT_TEST_LOG_VALIDATION
NEXT_TEST_MODE
NEXT_TEST_NATIVE_DIR
NEXT_TEST_WASM
NEXT_TEST_WASM_DIR
NEXT_TRACE_SPAN_THRESHOLD_MS
NEXT_TRACE_UPLOAD_DISABLED
NEXT_TRIGGER_URL
NEXT_TURBOPACK_USE_WORKER
NEXT_UNHANDLED_REJECTION_FILTER
NEXT_WEBPACK_LOGGING
NEXT_WEBPACK_PARALLELISM
NODE_BINDINGS_ARROW
NODE_BINDINGS_COMPILED_DIR
NODE_DEBUG
NODE_DISABLE_COLORS
NODE_ENV
NODE_EXTRA_CA_CERTS
NODE_INSPECTOR_IPC
NODE_OPTIONS
NODE_PATH
NODE_PRE_GYP_ABI_CROSSWALK
NODE_SKIP_PLATFORM_CHECK
NODE_UNIQUE_ID
NOPT_DEBUG
NOW_BUILDER
NO_DEPRECATION
NO_PROXY
OPENAI_API_KEY
OPENAI_API_KEY_ADMIN
OPENAI_API_KEY_PRICES
OPENNEXT_STATIC_ETAG
OPEN_NEXT_DANGEROUSLY_SET_ERROR_HEADERS
OPEN_NEXT_DEBUG
OPEN_NEXT_ERROR_LOG_LEVEL
OPEN_NEXT_FORCE_NON_EMPTY_RESPONSE
OPEN_NEXT_LOCAL_CACHE_SIZE
OPEN_NEXT_LOCAL_CACHE_TTL_MS
OPEN_NEXT_ORIGIN
OPEN_NEXT_REQUEST_ID_HEADER
OPEN_NEXT_VERSION
OSTYPE
PAGES_ENVIRONMENT
PATH
PATHEXT
PAYMENT_WEBHOOK_SECRET
PEXELS_API_KEY
PKG_CONFIG_PATH
PORT
PREBUILDS_ONLY
PROD
QTS_DEBUG
R
REACT_EDITOR
READABLE_STREAM
REGION_NAME
REMOVEBG_API_KEY
REPOSITORY_URL
RESEND_API_KEY
RESEND_FROM
REVALIDATION_QUEUE_REGION
RIVHIT_API_KEY
ROLLUP_FILTER_LOGS
ROLLUP_WATCH
RTL_SKIP_AUTO_CLEANUP
RUST_MIN_STACK
SASS_PATH
SENDGRID_API_KEY
SENDGRID_FROM
SENTRY_ANR_CHILD_PROCESS
SENTRY_BAGGAGE
SENTRY_DSN
SENTRY_ENVIRONMENT
SENTRY_NAME
SENTRY_RELEASE
SENTRY_TRACE
SENTRY_TRACES_SAMPLE_RATE
SENTRY_USE_ENVIRONMENT
SHARP_FORCE_GLOBAL_LIBVIPS
SHARP_IGNORE_GLOBAL_LIBVIPS
SHARP_VERSION
SKIP_NEXT_APP_BUILD
SKIP_UNRS_RESOLVER_FALLBACK
SKIP_WRANGLER_CONFIG_CHECK
SSR
STACK
SUCRASE_OPTIONS
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_SERVICE_ROLE_KEY
SYSTEMROOT
TEAM_WHATSAPP_NUMBERS
TENCENTCLOUD_APPID
TENCENTCLOUD_REGION
TENCENTCLOUD_ZONE
TERM
TERM_PROGRAM
TERSER_DEBUG_DIR
TEST
TESTING_TAR_FAKE_PLATFORM
TEST_DIST
TEST_GRACEFUL_FS_GLOBAL_PATCH
TIMING
TMPDIR
TRACE_DEPRECATION
TRACE_ID
TSC_NONPOLLING_WATCHER
TSC_WATCHDIRECTORY
TSC_WATCHFILE
TSESTREE_NO_INVALIDATION
TSESTREE_SINGLE_RUN
TSS_LOG
TSS_TRACE
TURBOPACK
TURBOPACK_STATS
TURBOREPO_TRACE_FILE
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
TWILIO_MESSAGING_SERVICE_SID
TWILIO_VERIFY_SERVICE_SID
TYPESCRIPT_ESLINT_IGNORE_PROJECT_AND_PROJECT_SERVICE_ERROR
TYPESCRIPT_ESLINT_PROJECT_SERVICE
UNDICI_NO_WASM_SIMD
UNRS_RESOLVER_YARN_PNP
UPAY_API_KEY
UPAY_API_USERNAME
UPDATE_SNAPSHOT
USER
USERNAME
USERPROFILE
UV_THREADPOOL_SIZE
VAPID_PRIVATE_KEY
VAPID_SUBJECT
VAR
VERCEL
VERCEL_BITBUCKET_COMMIT_SHA
VERCEL_BRANCH_URL
VERCEL_ENV
VERCEL_GITHUB_COMMIT_SHA
VERCEL_GITLAB_COMMIT_SHA
VERCEL_GIT_COMMIT_SHA
VERCEL_PROJECT_PRODUCTION_URL
VERCEL_REGION
VERCEL_URL
VISUAL
VITEST
VITEST_DEBUG_DUMP
VITEST_MAX_WORKERS
VITEST_MODE
VITEST_MODULE_DIRECTORIES
VITEST_POOL_ID
VITEST_SKIP_INSTALL_CHECKS
VITEST_VM_POOL
VITEST_WORKER_ID
VITE_DEBUG_FILTER
VITE_NAME
VITE_USER_NODE_ENV
VSCODE_INSPECTOR_OPTIONS
WARM_PARAMS
WATCHPACK_POLLING
WATCHPACK_RECURSIVE_WATCHER_LOGGING
WATCHPACK_WATCHER_LIMIT
WEBHOOK_SECRET
WEBHOOK_VERIFY_TOKEN
WEBSITE_SITE_NAME
WHATSAPP_PHONE_ID
WRANGLER_API_ENVIRONMENT
WRANGLER_DISABLE_REQUEST_BODY_DRAINING
WRANGLER_DOCKER_HOST
WRANGLER_LOG
WS_NO_BUFFER_UTIL
WS_NO_UTF_
XDG_CACHE_HOME
YARGS_MIN_NODE_VERSION
YCLOUD_API_KEY
YOUCH_CAUSE
YOUCH_RAW
ZEIT_BITBUCKET_COMMIT_SHA
ZEIT_GITHUB_COMMIT_SHA
ZEIT_GITLAB_COMMIT_SHA
_CLUSTER_NETWORK_NAME_
_ISEXE_TEST_PLATFORM_
__FAKE_PLATFORM__
__INTERNAL_CUSTOM_TURBOPACK_BINDINGS
__IS_WSL_TEST__
__MINIMATCH_TESTING_PLATFORM__
__NEXT_ALLOWED_REVALIDATE_HEADERS
__NEXT_APP_NAV_FAIL_HANDLING
__NEXT_ASSET_PREFIX
__NEXT_BASE_PATH
__NEXT_BROWSER_DEBUG_INFO_IN_TERMINAL
__NEXT_BUILD_ID
__NEXT_BUNDLER
__NEXT_BUNDLER_HAS_PERSISTENT_CACHE
__NEXT_CACHE_COMPONENTS
__NEXT_CASE_SENSITIVE_ROUTES
__NEXT_CLIENT_PARAM_PARSING
__NEXT_CLIENT_ROUTER_DYNAMIC_STALETIME
__NEXT_CLIENT_ROUTER_D_FILTER
__NEXT_CLIENT_ROUTER_FILTER_ENABLED
__NEXT_CLIENT_ROUTER_STATIC_STALETIME
__NEXT_CLIENT_ROUTER_S_FILTER
__NEXT_CLIENT_SEGMENT_CACHE
__NEXT_CLIENT_VALIDATE_RSC_REQUEST_HEADERS
__NEXT_CONFIG_OUTPUT
__NEXT_CROSS_ORIGIN
__NEXT_DEVTOOL_SEGMENT_EXPLORER
__NEXT_DEV_INDICATOR
__NEXT_DEV_INDICATOR_COOLDOWN_MS
__NEXT_DEV_INDICATOR_POSITION
__NEXT_DEV_SERVER
__NEXT_DISABLE_MEMORY_WATCHER
__NEXT_DIST_DIR
__NEXT_DYNAMIC_ON_HOVER
__NEXT_EDGE_PROJECT_DIR
__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS
__NEXT_EXPERIMENTAL_CACHED_NAVIGATIONS
__NEXT_EXPERIMENTAL_CACHE_COMPONENTS
__NEXT_EXPERIMENTAL_HTTPS
__NEXT_EXPERIMENTAL_PPR
__NEXT_EXPERIMENTAL_REACT
__NEXT_EXPERIMENTAL_STATIC_SHELL_DEBUGGING
__NEXT_EXPOSE_TESTING_API
__NEXT_EXTERNAL_MIDDLEWARE_REWRITE_RESOLVE
__NEXT_FETCH_CACHE_KEY_PREFIX
__NEXT_GESTURE_TRANSITION
__NEXT_HAS_REWRITES
__NEXT_HAS_WEB_VITALS_ATTRIBUTION
__NEXT_I
__NEXT_IMAGE_OPTS
__NEXT_LINK_NO_TOUCH_START
__NEXT_MANUAL_CLIENT_BASE_PATH
__NEXT_MANUAL_TRAILING_SLASH
__NEXT_MIDDLEWARE_MATCHERS
__NEXT_MIDDLEWARE_PREFETCH
__NEXT_MULTI_ZONE_DRAFT_MODE
__NEXT_NO_MIDDLEWARE_URL_NORMALIZE
__NEXT_OPTIMISTIC_CLIENT_CACHE
__NEXT_OPTIMISTIC_ROUTING
__NEXT_OPTIMIZE_CSS
__NEXT_OPTIMIZE_ROUTER_SCROLL
__NEXT_PPR
__NEXT_PREFETCH_INLINING
__NEXT_PREVIEW_MODE_ENCRYPTION_KEY
__NEXT_PREVIEW_MODE_ID
__NEXT_PREVIEW_MODE_SIGNING_KEY
__NEXT_PRIVATE_CPU_PROFILE
__NEXT_PRIVATE_DETERMINISTIC_BUILD_OUTPUT
__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE
__NEXT_PRIVATE_ORIGIN
__NEXT_PRIVATE_PREBUNDLED_REACT
__NEXT_PRIVATE_RENDER_WORKER
__NEXT_PRIVATE_RUNTIME_TYPE
__NEXT_PRIVATE_STANDALONE_CONFIG
__NEXT_PROCESSED_ENV
__NEXT_RELATIVE_DIST_DIR
__NEXT_RELATIVE_PROJECT_DIR
__NEXT_REWRITES
__NEXT_ROUTER_BASEPATH
__NEXT_ROUTER_BF_CACHE
__NEXT_SCRIPT_WORKERS
__NEXT_SCROLL_RESTORATION
__NEXT_STRICT_MODE
__NEXT_STRICT_MODE_APP
__NEXT_TELEMETRY_DISABLED
__NEXT_TEST_MAX_ISR_CACHE
__NEXT_TEST_MODE
__NEXT_TEST_WITH_DEVTOOL
__NEXT_TRAILING_SLASH
__NEXT_TRUST_HOST_HEADER
__NEXT_USE_CACHE
__NEXT_VARY_PARAMS
__NEXT_VERBOSE_LOGGING
__NEXT_WEB_VITALS_ATTRIBUTION
__TESTING_MKDIRP_NODE_VERSION__
__TESTING_MKDIRP_PLATFORM__
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS
```

---

## 📌 How to Use This Map

1. **Starting a new season?** Read this entire file first.
2. **Writing tests?** Use sections 5-9 for coverage targets.
3. **Onboarding Claude?** Paste this file as context.
4. **Found an issue?** Add it to Section 11.
5. **Regenerate after changes:** `bash clalmobile-project-map.sh`

> ⚡ This file is auto-generated. Do not edit manually.
> Run `bash clalmobile-project-map.sh` to refresh.
