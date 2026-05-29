-- =========================================================================
-- 20260529100000_captain_pin.sql
--
-- PIN del capità + registre de dispositius de confiança.
--
-- - `players.pin_hash` guarda el hash PBKDF2 (sha256, 100k iter, sal 16B) del
--   PIN numèric escollit pel capità.
-- - `captain_devices` registra els dispositius (browsers) en què el capità
--   ha desbloquejat el panell. El PIN només és vàlid des d'un d'aquests
--   dispositius (lligat via cookie signada `captain_device_id`).
-- =========================================================================

set search_path = public;

alter table players
  add column if not exists pin_hash text;

create table if not exists captain_devices (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  device_id   text not null,
  device_label text,
  last_used_at timestamptz default now(),
  created_at  timestamptz default now(),
  unique (player_id, device_id)
);

create index if not exists captain_devices_player_idx on captain_devices(player_id);

alter table captain_devices enable row level security;

drop policy if exists "captain_devices_owner_read" on captain_devices;
create policy "captain_devices_owner_read"
  on captain_devices for select
  using (player_id = (select id from players where auth_user_id = auth.uid()));

drop policy if exists "captain_devices_owner_write" on captain_devices;
create policy "captain_devices_owner_write"
  on captain_devices for all
  using (player_id = (select id from players where auth_user_id = auth.uid()))
  with check (player_id = (select id from players where auth_user_id = auth.uid()));
