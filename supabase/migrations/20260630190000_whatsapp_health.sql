-- =========================================================================
-- 20260630190000_whatsapp_health.sql
-- Estat de salut de la connexió de WhatsApp (Evolution/Baileys). El cron
-- /api/cron/wa-health hi escriu cada ~30 min. Singleton (una sola fila).
-- Només s'hi accedeix amb el service client (cron), per això RLS sense
-- polítiques: ningú més hi pot tocar.
-- =========================================================================

set search_path = public;

create table if not exists whatsapp_health (
  id               boolean primary key default true,
  is_healthy       boolean not null default true,
  last_ok_at       timestamptz,
  last_failure_at  timestamptz,
  last_alert_at    timestamptz,
  last_detail      text,
  updated_at       timestamptz not null default now(),
  constraint whatsapp_health_singleton check (id)
);

insert into whatsapp_health (id, is_healthy) values (true, true)
on conflict (id) do nothing;

alter table whatsapp_health enable row level security;
-- Sense polítiques: el service client salta RLS; cap altre rol hi accedeix.
