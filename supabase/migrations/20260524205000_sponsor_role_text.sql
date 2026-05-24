-- =========================================================================
-- 20260524205000_sponsor_role_text.sql
-- Texto de rol/descripción por patrocinador (bilingüe), p. ej.
-- "Organitzador del torneig" o "Patrocinador de les samarretes oficials".
-- =========================================================================

set search_path = public;

alter table sponsors
  add column if not exists role_ca text,
  add column if not exists role_es text;
