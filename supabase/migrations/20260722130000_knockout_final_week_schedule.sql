-- =========================================================================
-- 20260722130000_knockout_final_week_schedule.sql
-- Calendari FIX de l'eliminatòria (3-7 d'agost 2026), decidit amb l'admin:
-- cada ronda de cada categoria té ja un dia/hora/pista assignats abans que
-- se sàpiga quines parelles hi jugaran. Quan es genera la ronda 1
-- (lib/knockout.ts) o el trigger crea la ronda següent (advance_knockout),
-- es consulta aquesta taula i s'aplica directament — sense cap pas manual.
--
-- Regles acordades:
--  - 1a (principal i consolació) sempre a Pista 1 o 2 (mai Pista 3).
--  - Resta de categories: qualsevol pista.
--  - Dv 7 ag només Final 1a i Final 2a (totes dues a Pista 2, seguides).
--  - Dj 6 ag: finals principals (3a, 4a) i final consolació 1a a les
--    20:30; finals de consolació 2a i 3a a les 22:00.
-- =========================================================================

set search_path = public;

create table if not exists public.knockout_final_week_schedule (
  category_level int not null,
  bracket text not null check (bracket in ('ko', 'cons')),
  round_number int not null,
  position int not null,
  match_date date not null,
  match_time text not null check (match_time in ('20:30', '22:00')),
  court_label text not null,
  primary key (category_level, bracket, round_number, position)
);

alter table public.knockout_final_week_schedule enable row level security;
-- Sense policies: només es llegeix des de funcions security definer
-- (generateKnockoutForCategory via client d'admin/servei, i el trigger
-- advance_knockout), que salten la RLS.

insert into public.knockout_final_week_schedule
  (category_level, bracket, round_number, position, match_date, match_time, court_label)
values
  -- ---- 1a categoria (dl semis, dc cons-semis, dj final cons, dv final) ----
  (1, 'ko',   1, 1, '2026-08-03', '20:30', 'Pista 1'),
  (1, 'ko',   1, 2, '2026-08-03', '20:30', 'Pista 2'),
  (1, 'ko',   2, 1, '2026-08-07', '22:00', 'Pista 2'),
  (1, 'cons', 1, 1, '2026-08-05', '20:30', 'Pista 1'),
  (1, 'cons', 1, 2, '2026-08-05', '22:00', 'Pista 2'),
  (1, 'cons', 2, 1, '2026-08-06', '20:30', 'Pista 1'),

  -- ---- 2a categoria (dl quarts, dc semis, dj final cons, dv final) ----
  (2, 'ko',   1, 1, '2026-08-03', '20:30', 'Pista 3'),
  (2, 'ko',   1, 2, '2026-08-03', '22:00', 'Pista 1'),
  (2, 'ko',   1, 3, '2026-08-03', '22:00', 'Pista 2'),
  (2, 'ko',   1, 4, '2026-08-03', '22:00', 'Pista 3'),
  (2, 'ko',   2, 1, '2026-08-05', '20:30', 'Pista 2'),
  (2, 'ko',   2, 2, '2026-08-05', '22:00', 'Pista 1'),
  (2, 'ko',   3, 1, '2026-08-07', '20:30', 'Pista 2'),
  (2, 'cons', 1, 1, '2026-08-05', '20:30', 'Pista 3'),
  (2, 'cons', 1, 2, '2026-08-05', '22:00', 'Pista 3'),
  (2, 'cons', 2, 1, '2026-08-06', '22:00', 'Pista 1'),

  -- ---- 3a categoria (dm semis, dj finals) ----
  (3, 'ko',   1, 1, '2026-08-04', '20:30', 'Pista 1'),
  (3, 'ko',   1, 2, '2026-08-04', '22:00', 'Pista 1'),
  (3, 'ko',   2, 1, '2026-08-06', '20:30', 'Pista 2'),
  (3, 'cons', 1, 1, '2026-08-04', '20:30', 'Pista 3'),
  (3, 'cons', 1, 2, '2026-08-04', '22:00', 'Pista 3'),
  (3, 'cons', 2, 1, '2026-08-06', '22:00', 'Pista 2'),

  -- ---- 4a categoria (dm semis, dj final) — sense consolació ----
  (4, 'ko', 1, 1, '2026-08-04', '20:30', 'Pista 2'),
  (4, 'ko', 1, 2, '2026-08-04', '22:00', 'Pista 2'),
  (4, 'ko', 2, 1, '2026-08-06', '20:30', 'Pista 3')
on conflict (category_level, bracket, round_number, position) do nothing;

-- -------------------------------------------------------------------------
-- tournament_milestones: pany d'idempotència genèric per a esdeveniments que
-- només s'han de notificar UNA vegada (p.ex. "s'ha acabat la fase de grups
-- de tot el torneig"). Mateix patró que cron_daily_runs.
-- -------------------------------------------------------------------------
create table if not exists public.tournament_milestones (
  key text primary key,
  reached_at timestamptz not null default now()
);

alter table public.tournament_milestones enable row level security;

-- -------------------------------------------------------------------------
-- advance_knockout: ara, en crear la ronda següent, també li aplica el
-- calendari fix si n'hi ha (knockout_final_week_schedule). Si assignar-hi
-- data/pista xoqués amb un altre partit ja programat (matches_prevent_overlap
-- — p.ex. un jugador ja té partit a una altra categoria a la mateixa hora),
-- es desa igualment el partit però SENSE data/pista, perquè un conflicte de
-- calendari mai bloquegi l'avanç del quadre.
-- -------------------------------------------------------------------------
create or replace function public.advance_knockout()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bracket text;
  v_round int;
  v_pending int;
  v_winners uuid[];
  v_next text;
  v_n int;
  v_level int;
  v_slot record;
  v_sched_at timestamptz;
  v_court text;
  k int;
begin
  if NEW.status not in ('validated', 'walkover') or NEW.winner_pair_id is null then
    return NEW;
  end if;
  if NEW.phase !~ '^(ko|cons)_[0-9]+$' then
    return NEW;
  end if;

  v_bracket := split_part(NEW.phase, '_', 1);
  v_round := split_part(NEW.phase, '_', 2)::int;

  select count(*) filter (where status not in ('validated', 'walkover') or winner_pair_id is null)
    into v_pending
  from matches where category_id = NEW.category_id and phase = NEW.phase;
  if v_pending > 0 then return NEW; end if;

  select array_agg(winner_pair_id order by group_label::int) into v_winners
  from matches where category_id = NEW.category_id and phase = NEW.phase;

  v_n := array_length(v_winners, 1);
  if v_n <= 1 then return NEW; end if;

  v_next := v_bracket || '_' || (v_round + 1);
  if exists (select 1 from matches where category_id = NEW.category_id and phase = v_next) then
    return NEW;
  end if;

  select level into v_level from categories where id = NEW.category_id;

  for k in 1..(v_n / 2) loop
    v_sched_at := null;
    v_court := null;
    select match_date, match_time, court_label into v_slot
      from knockout_final_week_schedule
      where category_level = v_level and bracket = v_bracket
        and round_number = v_round + 1 and position = k;
    if found then
      v_sched_at := (v_slot.match_date::text || 'T' || v_slot.match_time || ':00+02:00')::timestamptz;
      v_court := v_slot.court_label;
    end if;

    begin
      insert into matches (
        tournament_id, category_id, phase, group_label, pair_a_id, pair_b_id, status,
        scheduled_at, court_label
      )
      values (
        NEW.tournament_id, NEW.category_id, v_next, k::text, v_winners[2 * k - 1], v_winners[2 * k],
        'scheduled', v_sched_at, v_court
      );
    exception when others then
      -- Xoc de calendari (p.ex. un jugador ja té partit a aquella hora en
      -- una altra categoria): es desa igualment el partit, sense data/pista.
      insert into matches (tournament_id, category_id, phase, group_label, pair_a_id, pair_b_id, status)
      values (NEW.tournament_id, NEW.category_id, v_next, k::text, v_winners[2 * k - 1], v_winners[2 * k], 'scheduled');
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists matches_advance_knockout on public.matches;
create trigger matches_advance_knockout
  after update on public.matches
  for each row execute function public.advance_knockout();
