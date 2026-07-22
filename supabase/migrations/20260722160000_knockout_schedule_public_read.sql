-- =========================================================================
-- 20260722160000_knockout_schedule_public_read.sql
-- Permet lectura pública del calendari fix de l'eliminatòria (dates/hores/
-- pistes, cap dada sensible) — cal perquè la previsió de quadre a la web
-- pública i al panell de capità pugui mostrar quan es jugarà cada ronda
-- abans que es generi el quadre real.
-- =========================================================================

set search_path = public;

create policy "knockout_final_week_schedule_public_read"
  on knockout_final_week_schedule for select
  using (true);
