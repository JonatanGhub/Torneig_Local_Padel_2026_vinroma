-- =========================================================================
-- 20260722140000_knockout_schedule_drop_p1_add_1900.sql
-- Reajust del calendari fix de l'eliminatòria (3-7 ago), acordat amb
-- l'organització: la Pista 1 surt del repartiment per defecte (queda
-- disponible NOMÉS com a opció de reprogramació — vegeu KO_COURTS a
-- lib/scheduling/official-slots.ts, que no canvia) i s'afegeix les 19:00
-- com a hora vàlida per a Pista 2 i Pista 3. Mateixa capacitat diària
-- (2 pistes × 3 hores = 6 slots, igual que abans amb 3 pistes × 2 hores).
-- =========================================================================

set search_path = public;

alter table public.knockout_final_week_schedule
  drop constraint if exists knockout_final_week_schedule_match_time_check;
alter table public.knockout_final_week_schedule
  add constraint knockout_final_week_schedule_match_time_check
  check (match_time in ('19:00', '20:30', '22:00'));

delete from public.knockout_final_week_schedule;

insert into public.knockout_final_week_schedule
  (category_level, bracket, round_number, position, match_date, match_time, court_label)
values
  -- ---- 1a categoria — sempre Pista 2 (regla "1a mai a P3/P1") ----
  (1, 'ko',   1, 1, '2026-08-03', '19:00', 'Pista 2'),
  (1, 'ko',   1, 2, '2026-08-03', '20:30', 'Pista 2'),
  (1, 'ko',   2, 1, '2026-08-07', '22:00', 'Pista 2'),
  (1, 'cons', 1, 1, '2026-08-05', '19:00', 'Pista 2'),
  (1, 'cons', 1, 2, '2026-08-05', '20:30', 'Pista 2'),
  (1, 'cons', 2, 1, '2026-08-06', '20:30', 'Pista 2'),

  -- ---- 2a categoria ----
  (2, 'ko',   1, 1, '2026-08-03', '19:00', 'Pista 3'),
  (2, 'ko',   1, 2, '2026-08-03', '20:30', 'Pista 3'),
  (2, 'ko',   1, 3, '2026-08-03', '22:00', 'Pista 3'),
  (2, 'ko',   1, 4, '2026-08-03', '22:00', 'Pista 2'),
  (2, 'ko',   2, 1, '2026-08-05', '19:00', 'Pista 3'),
  (2, 'ko',   2, 2, '2026-08-05', '20:30', 'Pista 3'),
  (2, 'ko',   3, 1, '2026-08-07', '20:30', 'Pista 2'),
  (2, 'cons', 1, 1, '2026-08-05', '22:00', 'Pista 2'),
  (2, 'cons', 1, 2, '2026-08-05', '22:00', 'Pista 3'),
  (2, 'cons', 2, 1, '2026-08-06', '22:00', 'Pista 2'),

  -- ---- 3a categoria ----
  (3, 'ko',   1, 1, '2026-08-04', '19:00', 'Pista 2'),
  (3, 'ko',   1, 2, '2026-08-04', '19:00', 'Pista 3'),
  (3, 'ko',   2, 1, '2026-08-06', '20:30', 'Pista 3'),
  (3, 'cons', 1, 1, '2026-08-04', '22:00', 'Pista 2'),
  (3, 'cons', 1, 2, '2026-08-04', '22:00', 'Pista 3'),
  (3, 'cons', 2, 1, '2026-08-06', '22:00', 'Pista 3'),

  -- ---- 4a categoria — sense consolació ----
  (4, 'ko', 1, 1, '2026-08-04', '20:30', 'Pista 2'),
  (4, 'ko', 1, 2, '2026-08-04', '20:30', 'Pista 3'),
  (4, 'ko', 2, 1, '2026-08-06', '19:00', 'Pista 3');
