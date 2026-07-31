-- =========================================================================
-- 20260728110000_knockout_schedule_preferences.sql
-- Preferències d'horari dels capitans per a la setmana de l'eliminatòria
-- (3-7 d'agost). Cada capità indica, per parella i per dia, si NO pot
-- jugar, si li va bé o si és el seu dia preferit, més una nota lliure
-- (p.ex. "a partir de les 21h millor"). Substitueix el degoteig de
-- missatges privats de WhatsApp a l'organització.
--
-- day_prefs: objecte {"2026-08-03": "no" | "ok" | "prefer", ...} — només
-- els dies que el capità ha marcat; els no presents són "indiferent".
-- =========================================================================

set search_path = public;

create table if not exists public.knockout_schedule_preferences (
  pair_id uuid primary key references pairs(id) on delete cascade,
  updated_by_player_id uuid references players(id),
  day_prefs jsonb not null default '{}'::jsonb,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.knockout_schedule_preferences enable row level security;

-- L'admin llegeix des del panell (client amb sessió + RLS). Les escriptures
-- i lectures del capità van pel service client als server actions (salten
-- la RLS) després de comprovar que és el capità de la parella.
create policy "knockout_schedule_preferences_admin_read"
  on public.knockout_schedule_preferences for select
  using (is_admin());
