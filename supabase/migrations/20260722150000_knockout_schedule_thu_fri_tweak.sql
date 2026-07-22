-- =========================================================================
-- 20260722150000_knockout_schedule_thu_fri_tweak.sql
-- Ajust final del calendari de dijous i divendres, acordat amb l'organització:
--  - Dj 6 ago: Final 3a passa a les 19:00 (Pista 2); Final consolació 2a
--    passa a les 20:30 (Pista 3).
--  - Dv 7 ago: Final 2a passa a les 19:00; Final 1a passa a les 20:30
--    (totes dues es mantenen a Pista 2).
-- =========================================================================

set search_path = public;

update public.knockout_final_week_schedule
  set match_time = '19:00', court_label = 'Pista 2'
  where category_level = 3 and bracket = 'ko' and round_number = 2 and position = 1;

update public.knockout_final_week_schedule
  set match_time = '20:30', court_label = 'Pista 3'
  where category_level = 2 and bracket = 'cons' and round_number = 2 and position = 1;

update public.knockout_final_week_schedule
  set match_time = '19:00'
  where category_level = 2 and bracket = 'ko' and round_number = 3 and position = 1;

update public.knockout_final_week_schedule
  set match_time = '20:30'
  where category_level = 1 and bracket = 'ko' and round_number = 2 and position = 1;
