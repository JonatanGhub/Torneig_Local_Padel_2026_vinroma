-- =========================================================================
-- 20260702150000_reschedule_reminder_sent.sql
-- Marca de recordatori per a propostes de canvi de data sense resposta.
--
-- El cron diari (08:00 Madrid) envia un recordatori per WhatsApp al capità
-- que ha de respondre quan una proposta porta >24h en 'pending'. Aquesta
-- columna evita repetir el recordatori cada dia (mateix patró que
-- matches.reminder_sent_at per a la validació de resultats).
-- =========================================================================

set search_path = public;

alter table match_reschedule_proposals
  add column if not exists reminder_sent_at timestamptz;
