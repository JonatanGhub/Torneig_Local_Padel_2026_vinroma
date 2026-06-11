-- =========================================================================
-- 20260611220000_fee_phase_warning_sent.sql
-- Idempotència de l'avís "últim dia al preu actual" al grup de WhatsApp.
-- Es marca cada tram quan ja s'ha enviat el seu avís, perquè el cron diari
-- no el repeteixi mai (encara que es dispari més d'un cop el mateix dia).
-- =========================================================================

set search_path = public;

alter table tournament_fees
  add column phase_change_warned_at timestamptz;
