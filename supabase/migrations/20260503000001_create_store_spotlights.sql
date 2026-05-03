-- =====================================================
-- ClalMobile — store_spotlights
-- Editorial 1+3 spotlight section on /store, managed from admin.
-- Each row links to an existing product and adds editorial copy
-- (eyebrow + tagline) shown in the spotlight card.
-- =====================================================

create extension if not exists "pgcrypto";

create table if not exists public.store_spotlights (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  -- 1 = the big "hero" card; 2,3,4 = the smaller cards beneath it
  position smallint not null check (position between 1 and 4),
  eyebrow_ar text default '',
  eyebrow_he text default '',
  tagline_ar text not null default '',
  tagline_he text default '',
  -- optional override; if null/empty the frontend falls back to product.image_url
  custom_image_url text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one ACTIVE entry per position. Inactive entries can sit at any position
-- (lets the admin keep "drafts" without conflicting).
create unique index if not exists store_spotlights_active_position_uniq
  on public.store_spotlights(position)
  where active = true;

create index if not exists store_spotlights_active_idx
  on public.store_spotlights(active, position);

create index if not exists store_spotlights_product_id_idx
  on public.store_spotlights(product_id);

-- Auto-bump updated_at
create or replace function public.touch_store_spotlights_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_store_spotlights_updated_at on public.store_spotlights;
create trigger trg_store_spotlights_updated_at
before update on public.store_spotlights
for each row execute function public.touch_store_spotlights_updated_at();

-- RLS: public read of active rows; writes restricted to service_role (admin API).
alter table public.store_spotlights enable row level security;

drop policy if exists "store_spotlights_public_read_active" on public.store_spotlights;
create policy "store_spotlights_public_read_active"
  on public.store_spotlights
  for select
  using (active = true);

drop policy if exists "store_spotlights_service_all" on public.store_spotlights;
create policy "store_spotlights_service_all"
  on public.store_spotlights
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.store_spotlights is
  'Editorial spotlight slots on /store (1 hero + 3 smaller). Managed from /admin/store-spotlights.';
