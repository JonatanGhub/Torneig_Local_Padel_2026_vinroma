-- =========================================================================
-- 20260528210000_match_reminder_sent_at.sql
-- Marca d'enviament del recordatori de partit (dedupe del cron de WhatsApp).
-- =========================================================================

set search_path = public;

alter table matches
  add column if not exists reminder_sent_at timestamptz;
