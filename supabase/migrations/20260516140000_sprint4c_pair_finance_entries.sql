-- =========================================================================
-- 20260516140000_sprint4c_pair_finance_entries.sql
-- Sprint 4c — Panel finanzas por pareja (ingresos/gastos)
-- =========================================================================

set search_path = public;

create type finance_entry_kind as enum ('income', 'expense');

create table pair_finance_entries (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  kind finance_entry_kind not null,
  amount_cents int not null check (amount_cents >= 0),
  label text not null,
  notes text,
  occurred_on date not null default current_date,
  created_by_player_id uuid not null references players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pair_finance_pair_idx on pair_finance_entries (pair_id, occurred_on desc);

create or replace function pair_finance_touch_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end$$;

create trigger pair_finance_entries_updated_at
  before update on pair_finance_entries
  for each row execute function pair_finance_touch_updated_at();

alter table pair_finance_entries enable row level security;

create policy "pair_finance_select_captain_or_admin"
  on pair_finance_entries for select
  using (
    is_admin()
    or exists (
      select 1 from pairs
      where pairs.id = pair_finance_entries.pair_id
        and pairs.captain_id = (select id from players where auth_user_id = auth.uid())
    )
  );

create policy "pair_finance_insert_captain"
  on pair_finance_entries for insert
  with check (
    is_admin()
    or exists (
      select 1 from pairs
      where pairs.id = pair_finance_entries.pair_id
        and pairs.captain_id = (select id from players where auth_user_id = auth.uid())
    )
  );

create policy "pair_finance_update_captain"
  on pair_finance_entries for update
  using (
    is_admin()
    or exists (
      select 1 from pairs
      where pairs.id = pair_finance_entries.pair_id
        and pairs.captain_id = (select id from players where auth_user_id = auth.uid())
    )
  );

create policy "pair_finance_delete_captain"
  on pair_finance_entries for delete
  using (
    is_admin()
    or exists (
      select 1 from pairs
      where pairs.id = pair_finance_entries.pair_id
        and pairs.captain_id = (select id from players where auth_user_id = auth.uid())
    )
  );

grant select, insert, update, delete on pair_finance_entries to authenticated;
