# 🔴 ClalMobile — E-Commerce Ecosystem

> وكيل رسمي معتمد لـ HOT Mobile — نظام تجارة إلكتروني متكامل

## 🏗️ Tech Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Hosting:** Cloudflare Pages
- **Domain:** clalmobile.com

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → run `supabase/migrations/001_initial_schema.sql`
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

## 📁 Project Structure

```
clalmobile/
├── app/
│   ├── store/        → المتجر (public)
│   ├── admin/        → لوحة الإدارة (protected)
│   ├── crm/          → CRM (protected)
│   ├── (auth)/login/ → تسجيل الدخول
│   └── api/          → API Routes
├── components/
│   ├── ui/           → مكونات مشتركة (Button, Card, Badge...)
│   ├── layouts/      → Sidebar, Header, TabNav
│   └── shared/       → مكونات متكررة
├── lib/
│   ├── supabase.ts   → Supabase clients
│   ├── auth.ts       → Authentication
│   ├── hooks.ts      → useScreen, useToast, useDebounce
│   ├── constants.ts  → Statuses, roles, banks, cities
│   ├── validators.ts → Israeli ID, Luhn, phone validation
│   └── utils.ts      → Formatters, helpers
├── types/
│   └── database.ts   → TypeScript types for all entities
├── styles/
│   └── globals.css   → Tailwind + Design System
└── supabase/
    └── migrations/   → SQL schema
```

## 🔐 Roles & Permissions

| Role | Access |
|------|--------|
| super_admin | Everything |
| admin | Products, Orders, Customers, Settings |
| sales | Orders, Customers, Pipeline, Tasks |
| support | Orders, Customers, Tasks |
| content | Products, Heroes, Emails |
| viewer | Read-only Orders & Customers |

## 📋 Order Statuses

```
جديد → موافق → قيد الشحن → تم التسليم
         ↘ مرفوض
         ↘ لا يوجد رد 1 → لا يوجد رد 2 → لا يوجد رد 3
```

## 📡 Order Sources
🛒 المتجر | 📘 فيسبوك | 🏪 متجر خارجي | 💬 واتساب | 🌐 شات الموقع | ✍️ يدوي

## 🗺️ Roadmap

- [x] Season 0: Infrastructure ← **أنت هنا**
- [ ] Season 1: Store (real backend)
- [ ] Season 2: Admin Panel (real CRUD)
- [ ] Season 3: CRM (real-time)
- [ ] Season 4: Bots (WhatsApp + WebChat)
- [ ] Season 5: Website
- [ ] Season 6: Launch
