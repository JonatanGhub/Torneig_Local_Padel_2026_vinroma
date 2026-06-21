-- =========================================================================
-- 20260612110000_registration_close_warning.sql
-- Idempotència de l'avís de tancament d'inscripcions al grup de WhatsApp.
-- =========================================================================

set search_path = public;

alter table tournaments
  add column registration_close_warned_at timestamptz;
