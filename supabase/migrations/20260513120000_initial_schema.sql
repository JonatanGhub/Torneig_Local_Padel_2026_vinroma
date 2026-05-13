-- =========================================================================
-- 20260513120000_initial_schema.sql
-- Esquema base del torneo (Sprint 1 — foundation)
-- =========================================================================
-- Cubre las decisiones de Fase 1 que afectan al modelo de datos:
--   - §4  Categorías por nivel
--   - §6  Capacidad por categoría
--   - §12 Calendario
--   - §13/§14 Pago dual (por pareja o por persona) escalonado
--   - §16 Bizum / transferencia
--   - §21 RGPD (campos anonimizables + retención)
--   - §24 Audit log genérico
--   - §25 RBAC con flujo de validación cruzada (matches + match_reports)
--   - §31 Elegibilidad declarativa
--   - §32 Menores con consentimiento parental
-- =========================================================================

set search_path = public;

-- -------------------------------------------------------------------------
-- Extensions
-- -------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- emails case-insensitive

-- -------------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------------
create type user_role as enum ('anon', 'captain', 'admin');
create type payment_method as enum ('bizum', 'transfer');
create type payment_status as enum ('pending', 'paid', 'refunded', 'cancelled');
create type pair_status as enum ('draft', 'pending_payment', 'confirmed', 'withdrawn', 'disqualified');
create type match_status as enum ('scheduled', 'pending_validation', 'validated', 'disputed', 'walkover');
create type fee_mode as enum ('per_pair', 'per_player');

-- -------------------------------------------------------------------------
-- Tournaments (V Torneig 2026, futuras ediciones)
-- -------------------------------------------------------------------------
create table tournaments (
  id          uuid primary key default gen_random_uuid(),
  edition     integer not null unique,           -- 5, 6, 7…
  year        integer not null,                  -- 2026
  slug        text not null unique,              -- "v-2026"
  name_ca     text not null,
  name_es     text not null,
  registration_opens_at  timestamptz not null,
  registration_closes_at timestamptz not null,
  draw_at                timestamptz not null,
  first_match_at         timestamptz not null,
  final_at               timestamptz not null,
  is_published    boolean not null default false,
  fee_mode_default fee_mode not null default 'per_pair',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Tournament fees (parametrizable — §14 en votación)
-- Por defecto: opción C escalonada del organizador.
-- Cambiar tras voto de capitanes = sustituir filas, sin redeploy.
-- -------------------------------------------------------------------------
create table tournament_fees (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  label_ca      text not null,                   -- "Tram 1 (super early)"
  label_es      text not null,                   -- "Tramo 1 (super early)"
  starts_at     timestamptz not null,            -- inclusive
  ends_at       timestamptz not null,            -- inclusive (23:59:59)
  amount_per_player_cents integer not null,      -- 1500 = 15.00 €
  is_default_open boolean not null default true, -- false = sólo abierto a discreción admin (fuera de plazo)
  created_at    timestamptz not null default now()
);

create index on tournament_fees (tournament_id, starts_at);

-- -------------------------------------------------------------------------
-- Categories (1ª, 2ª, 3ª, 4ª por edición)
-- -------------------------------------------------------------------------
create table categories (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  level         integer not null,                -- 1, 2, 3, 4
  name_ca       text not null,
  name_es       text not null,
  max_pairs     integer not null default 8,
  unique (tournament_id, level)
);

-- -------------------------------------------------------------------------
-- Players (jugadores individuales — datos personales anonimizables)
-- -------------------------------------------------------------------------
create table players (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  -- Datos personales (NULL tras anonimización)
  first_name      text,
  last_name       text,
  email           citext,
  phone           text,
  birth_date      date,
  declared_level  integer,                       -- 1, 2, 3, 4 (auto-declarado)
  -- Menores (§32): tutor legal
  legal_guardian_name      text,
  legal_guardian_dni       text,
  legal_guardian_phone     text,
  legal_guardian_email     citext,
  is_minor                 boolean generated always as (
    birth_date is not null and birth_date > (current_date - interval '18 years')
  ) stored,
  -- Consentimientos RGPD
  consent_data_processing  boolean not null default false,
  consent_results_publication boolean not null default false,
  consent_whatsapp         boolean not null default false,
  consent_signed_at        timestamptz,
  -- Anonimización (§21.5)
  is_anonymized            boolean not null default false,
  anonymized_at            timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on players (auth_user_id);
create index on players (email) where is_anonymized = false;

-- -------------------------------------------------------------------------
-- Pairs (parejas inscritas)
-- -------------------------------------------------------------------------
create table pairs (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  category_id     uuid references categories(id) on delete set null,
  player_a_id     uuid not null references players(id) on delete restrict,
  player_b_id     uuid not null references players(id) on delete restrict,
  captain_id      uuid not null references players(id),    -- siempre uno de los 2
  status          pair_status not null default 'draft',
  fee_mode_chosen fee_mode not null,                       -- la pareja eligió al inscribirse
  withdrawn_at    timestamptz,
  withdrawal_reason text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (player_a_id <> player_b_id),
  check (captain_id in (player_a_id, player_b_id))
);

create index on pairs (tournament_id, status);
create index on pairs (category_id);

-- -------------------------------------------------------------------------
-- Payments (1 fila por transacción Bizum/transferencia)
-- - Modo per_pair: 1 fila con pair_id, player_id=NULL, payer_player_id=quien pagó
-- - Modo per_player: 2 filas, una por jugador con player_id=él mismo
-- -------------------------------------------------------------------------
create table payments (
  id              uuid primary key default gen_random_uuid(),
  pair_id         uuid not null references pairs(id) on delete cascade,
  player_id       uuid references players(id) on delete set null,   -- NULL en modo per_pair
  payer_player_id uuid not null references players(id),              -- quién efectúa la transacción
  fee_id          uuid not null references tournament_fees(id),
  method          payment_method not null,
  amount_cents    integer not null,                                  -- importe efectivo recibido
  reference_code  text not null unique,                              -- "2026-P0042-LOPEZ"
  status          payment_status not null default 'pending',
  reconciled_by   uuid references auth.users(id),                    -- admin que concilió
  reconciled_at   timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on payments (pair_id, status);
create index on payments (status, created_at);

-- -------------------------------------------------------------------------
-- Matches (partidos)
-- -------------------------------------------------------------------------
create table matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  category_id     uuid not null references categories(id) on delete cascade,
  phase           text not null,                                -- "group", "ko_round_of_16", "ko_qf", "ko_sf", "final", "consolation_*"
  group_label     text,                                         -- "A", "B" en fase de grupos
  scheduled_at    timestamptz,
  court_label     text,                                         -- "Pista 1", "Pista 2", "Pista 3"
  pair_a_id       uuid not null references pairs(id),
  pair_b_id       uuid not null references pairs(id),
  status          match_status not null default 'scheduled',
  winner_pair_id  uuid references pairs(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (pair_a_id <> pair_b_id)
);

create index on matches (tournament_id, status, scheduled_at);
create index on matches (category_id, phase);

-- -------------------------------------------------------------------------
-- Sets (resultado consolidado por partido — sólo cuando validated)
-- -------------------------------------------------------------------------
create table sets (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id) on delete cascade,
  set_number   integer not null,                                -- 1, 2, 3
  games_a      integer not null,
  games_b      integer not null,
  tb_a         integer,
  tb_b         integer,
  unique (match_id, set_number)
);

-- -------------------------------------------------------------------------
-- Match reports (§25 — validación cruzada)
-- Cada capitán reporta UN registro por partido. Trigger compara.
-- -------------------------------------------------------------------------
create table match_reports (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  reporter_player_id uuid not null references players(id),
  reporter_pair_side text not null check (reporter_pair_side in ('a', 'b', 'admin')),
  score_json    jsonb not null,                                 -- [{ "set": 1, "a": 6, "b": 4 }, ...]
  reported_at   timestamptz not null default now(),
  unique (match_id, reporter_player_id)
);

create index on match_reports (match_id);

-- -------------------------------------------------------------------------
-- Audit log (§24 — trigger genérico)
-- -------------------------------------------------------------------------
create table audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_pk      text not null,
  operation   text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  actor_id    uuid,                                              -- auth.uid() si aplica
  occurred_at timestamptz not null default now()
);

create index on audit_log (table_name, row_pk);
create index on audit_log (occurred_at desc);

-- -------------------------------------------------------------------------
-- Helper: updated_at trigger
-- -------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tournaments_set_updated_at before update on tournaments
  for each row execute function set_updated_at();
create trigger players_set_updated_at before update on players
  for each row execute function set_updated_at();
create trigger pairs_set_updated_at before update on pairs
  for each row execute function set_updated_at();
create trigger payments_set_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger matches_set_updated_at before update on matches
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- Audit trigger genérico
-- -------------------------------------------------------------------------
create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_actor uuid;
  v_pk    text;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  v_pk := coalesce(
    case when TG_OP = 'DELETE' then (to_jsonb(old)->>'id') else (to_jsonb(new)->>'id') end,
    ''
  );

  insert into audit_log (table_name, row_pk, operation, old_data, new_data, actor_id)
  values (
    TG_TABLE_NAME,
    v_pk,
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    v_actor
  );

  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

create trigger pairs_audit after insert or update or delete on pairs
  for each row execute function audit_row_change();
create trigger payments_audit after insert or update or delete on payments
  for each row execute function audit_row_change();
create trigger matches_audit after insert or update or delete on matches
  for each row execute function audit_row_change();
create trigger sets_audit after insert or update or delete on sets
  for each row execute function audit_row_change();
create trigger match_reports_audit after insert or update on match_reports
  for each row execute function audit_row_change();

-- -------------------------------------------------------------------------
-- RLS — Row Level Security (§25)
-- -------------------------------------------------------------------------
alter table tournaments     enable row level security;
alter table tournament_fees enable row level security;
alter table categories      enable row level security;
alter table players         enable row level security;
alter table pairs           enable row level security;
alter table payments        enable row level security;
alter table matches         enable row level security;
alter table sets            enable row level security;
alter table match_reports   enable row level security;
alter table audit_log       enable row level security;

-- Helper: ¿el usuario autenticado es admin?
create or replace function is_admin()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Helper: ¿el usuario autenticado es capitán de la pareja X?
create or replace function is_captain_of(p_pair_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from pairs p
    join players pl on pl.id = p.captain_id
    where p.id = p_pair_id
      and pl.auth_user_id = auth.uid()
  );
$$;

-- Tournaments / fees / categories: lectura pública, escritura admin
create policy "tournaments_public_read"
  on tournaments for select using (is_published = true or is_admin());
create policy "tournaments_admin_write"
  on tournaments for all using (is_admin()) with check (is_admin());

create policy "fees_public_read"
  on tournament_fees for select using (true);
create policy "fees_admin_write"
  on tournament_fees for all using (is_admin()) with check (is_admin());

create policy "categories_public_read"
  on categories for select using (true);
create policy "categories_admin_write"
  on categories for all using (is_admin()) with check (is_admin());

-- Players: el propio jugador ve sus datos; admin ve todo
create policy "players_self_read"
  on players for select using (auth_user_id = auth.uid() or is_admin());
create policy "players_self_update"
  on players for update using (auth_user_id = auth.uid() or is_admin());
create policy "players_admin_insert"
  on players for insert with check (is_admin() or auth.uid() is not null);
create policy "players_admin_delete"
  on players for delete using (is_admin());

-- Pairs: lectura pública si tournament publicado; el capitán edita los suyos
create policy "pairs_public_read"
  on pairs for select
  using (
    exists (
      select 1 from tournaments t
      where t.id = pairs.tournament_id and t.is_published = true
    )
    or is_admin()
    or is_captain_of(pairs.id)
  );
create policy "pairs_captain_update"
  on pairs for update using (is_captain_of(id) or is_admin());
create policy "pairs_admin_write"
  on pairs for insert with check (is_admin() or auth.uid() is not null);
create policy "pairs_admin_delete"
  on pairs for delete using (is_admin());

-- Payments: el capitán ve sus pagos; admin ve todo
create policy "payments_captain_read"
  on payments for select using (is_captain_of(pair_id) or is_admin());
create policy "payments_admin_write"
  on payments for all using (is_admin()) with check (is_admin());

-- Matches / sets: lectura pública
create policy "matches_public_read"
  on matches for select using (true);
create policy "matches_admin_write"
  on matches for all using (is_admin()) with check (is_admin());

create policy "sets_public_read"
  on sets for select using (true);
create policy "sets_admin_write"
  on sets for all using (is_admin()) with check (is_admin());

-- Match reports: cada capitán inserta para sus partidos; lectura admin + propio
create policy "reports_captain_read"
  on match_reports for select
  using (
    is_admin()
    or exists (
      select 1 from matches m
      where m.id = match_reports.match_id
        and (is_captain_of(m.pair_a_id) or is_captain_of(m.pair_b_id))
    )
  );
create policy "reports_captain_insert"
  on match_reports for insert
  with check (
    is_admin()
    or exists (
      select 1 from matches m
      where m.id = match_reports.match_id
        and (is_captain_of(m.pair_a_id) or is_captain_of(m.pair_b_id))
    )
  );

-- Audit log: sólo admin lee
create policy "audit_admin_read"
  on audit_log for select using (is_admin());

-- -------------------------------------------------------------------------
-- Seed inicial: V Torneig 2026 + tarifas escalonadas + categorías
-- -------------------------------------------------------------------------
insert into tournaments (
  edition, year, slug, name_ca, name_es,
  registration_opens_at, registration_closes_at, draw_at, first_match_at, final_at,
  is_published, fee_mode_default
) values (
  5, 2026, 'v-2026',
  'V Torneig de Pàdel les Coves de Vinromà',
  'V Torneo de Pádel les Coves de Vinromà',
  '2026-06-01 00:00:00+02',
  '2026-06-30 23:59:59+02',
  '2026-07-01 20:00:00+02',
  '2026-07-06 16:00:00+02',
  '2026-08-09 19:00:00+02',
  false,  -- se publica desde el admin tras configurarse
  'per_pair'
)
on conflict (edition) do nothing;

-- Tarifas por defecto (opción C — escalonado, mientras se cierra el voto)
with t as (select id from tournaments where edition = 5)
insert into tournament_fees (
  tournament_id, label_ca, label_es,
  starts_at, ends_at, amount_per_player_cents, is_default_open
) values
  ((select id from t), 'Tram 1 (super early)', 'Tramo 1 (super early)',
   '2026-06-01 00:00:00+02', '2026-06-10 23:59:59+02', 1500, true),
  ((select id from t), 'Tram 2 (early)', 'Tramo 2 (early)',
   '2026-06-11 00:00:00+02', '2026-06-20 23:59:59+02', 2000, true),
  ((select id from t), 'Tram 3 (estàndar)', 'Tramo 3 (estándar)',
   '2026-06-21 00:00:00+02', '2026-06-30 23:59:59+02', 2500, true),
  ((select id from t), 'Recàrrec fora de termini', 'Recargo fuera de plazo',
   '2026-07-01 00:00:00+02', '2026-07-31 23:59:59+02', 3000, false);

-- Categorías
with t as (select id from tournaments where edition = 5)
insert into categories (tournament_id, level, name_ca, name_es, max_pairs) values
  ((select id from t), 1, '1a categoria', '1ª categoría', 8),
  ((select id from t), 2, '2a categoria', '2ª categoría', 8),
  ((select id from t), 3, '3a categoria', '3ª categoría', 8),
  ((select id from t), 4, '4a categoria', '4ª categoría', 8);
