-- iCal feed: cada jugador (capità o no) tiene un token estable para suscribirse
-- a sus partidos vía calendar feed (.ics).
alter table public.players
  add column if not exists calendar_feed_token uuid not null default gen_random_uuid();

create unique index if not exists players_calendar_feed_token_key
  on public.players(calendar_feed_token);

comment on column public.players.calendar_feed_token is
  'Token opaco para la URL pública del feed iCal (text/calendar). Regenerar revoca el feed.';
