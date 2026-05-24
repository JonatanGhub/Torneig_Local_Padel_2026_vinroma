-- =========================================================================
-- 20260524211000_match_reminder_sent_at.sql
-- Marca de envío del recordatorio de partido (dedupe del cron de WhatsApp).
-- =========================================================================

set search_path = public;

alter table matches
  add column if not exists reminder_sent_at timestamptz;
