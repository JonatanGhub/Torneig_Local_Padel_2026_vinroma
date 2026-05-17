-- =========================================================================
-- 20260516160000_sprint5_sponsors.sql
-- Sprint 5 — Patrocinadores
-- =========================================================================

set search_path = public;

create type sponsor_tier as enum ('gold', 'silver', 'bronze', 'collaborator');

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null,
  website_url text,
  tier sponsor_tier not null default 'collaborator',
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sponsors_active_tier_order_idx
  on sponsors (is_active, tier, display_order);

create or replace function sponsors_touch_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end$$;

create trigger sponsors_updated_at
  before update on sponsors
  for each row execute function sponsors_touch_updated_at();

alter table sponsors enable row level security;

create policy "sponsors_select_public"
  on sponsors for select using (true);

create policy "sponsors_insert_admin"
  on sponsors for insert with check (is_admin());

create policy "sponsors_update_admin"
  on sponsors for update using (is_admin());

create policy "sponsors_delete_admin"
  on sponsors for delete using (is_admin());

grant select on sponsors to anon, authenticated;
grant insert, update, delete on sponsors to authenticated;
