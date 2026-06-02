-- =========================================================================
-- 20260602060000_tournament_budget.sql
-- Pressupost del torneig: entrades manuals d'ingressos i despeses globals,
-- no lligades a una parella concreta. Permeten veure el balanç total
-- (ingressos d'inscripcions + patrocinis + extres − despeses) i calcular
-- el pressupost disponible per al picoteig final, premis, etc.
--
-- Els ingressos d'inscripcions NO es dupliquen aquí: ja venen de la taula
-- `payments` (status=reconciled). Aquí només ingressos extra (patrocinis,
-- ajuts, donacions) i totes les despeses.
-- =========================================================================

set search_path = public;

create type budget_entry_kind as enum ('income', 'expense');
create type budget_entry_category as enum (
  'sponsorship',     -- ingrés: patrocini en metàl·lic
  'donation',        -- ingrés: donació, aportació extra
  'other_income',    -- ingrés: altres
  'prizes',          -- despesa: premis
  'snacks',          -- despesa: picoteig final
  'venue',           -- despesa: lloguer pistes / instal·lacions
  'materials',       -- despesa: pilotes, samarretes, trofeus
  'services',        -- despesa: arbitres, fotografia, impressió
  'other_expense'    -- despesa: altres
);

create table tournament_budget_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  kind budget_entry_kind not null,
  category budget_entry_category not null,
  label text not null check (length(trim(label)) > 0 and length(label) <= 200),
  amount_cents integer not null check (amount_cents >= 0),
  occurred_on date not null default current_date,
  notes text check (length(notes) <= 1000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tournament_budget_entries_t_kind_idx
  on tournament_budget_entries (tournament_id, kind, occurred_on desc);

alter table tournament_budget_entries enable row level security;

-- Només admin pot fer res amb aquesta taula.
create policy "budget_admin_select" on tournament_budget_entries
  for select using (is_admin());
create policy "budget_admin_write" on tournament_budget_entries
  for insert with check (is_admin());
create policy "budget_admin_update" on tournament_budget_entries
  for update using (is_admin()) with check (is_admin());
create policy "budget_admin_delete" on tournament_budget_entries
  for delete using (is_admin());

grant select, insert, update, delete on tournament_budget_entries to authenticated;

create or replace function tournament_budget_entries_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tournament_budget_entries_set_updated
  before update on tournament_budget_entries
  for each row execute function tournament_budget_entries_touch_updated();
