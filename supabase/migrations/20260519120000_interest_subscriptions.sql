-- =========================================================================
-- 20260519120000_interest_subscriptions.sql
-- Pre-launch email capture: store interested visitors so the club can notify
-- them when registration opens. Inserts are open to anon; reads are admin-only.
-- =========================================================================

set search_path = public;

create table interest_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  email text not null,
  locale text not null check (locale in ('ca', 'es')),
  source text,
  created_at timestamptz not null default now(),
  unique (tournament_id, email)
);

create index interest_subscriptions_tournament_created_idx
  on interest_subscriptions (tournament_id, created_at desc);

alter table interest_subscriptions enable row level security;

create policy "interest_subscriptions_insert_public"
  on interest_subscriptions for insert with check (true);

create policy "interest_subscriptions_select_admin"
  on interest_subscriptions for select using (is_admin());

create policy "interest_subscriptions_delete_admin"
  on interest_subscriptions for delete using (is_admin());

grant insert on interest_subscriptions to anon, authenticated;
grant select, delete on interest_subscriptions to authenticated;
