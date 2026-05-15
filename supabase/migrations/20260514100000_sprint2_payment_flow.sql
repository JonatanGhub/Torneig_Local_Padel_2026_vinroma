-- =========================================================================
-- 20260514100000_sprint2_payment_flow.sql
-- Sprint 2 — Flujo de inscripción y pago
-- =========================================================================
-- Añade:
--   - club_settings (singleton): datos bancarios y de contacto del club
--   - generate_payment_reference(): concepto único determinístico
--   - current_active_fee(): tramo de tarifa activo en una fecha dada
--   - confirm_pair_if_all_paid(): trigger que pasa pareja a confirmed
--   - índices y políticas RLS adicionales
-- =========================================================================

set search_path = public;

-- -------------------------------------------------------------------------
-- Club settings (singleton — solo 1 fila esperada)
-- -------------------------------------------------------------------------
create table club_settings (
  id          uuid primary key default gen_random_uuid(),
  -- Identidad
  legal_name  text not null,
  cif         text,
  address     text,
  email       citext not null,
  -- Datos bancarios (para pantalla de pago)
  bizum_phone text,                                    -- "+34 620 xx xx xx"
  iban        text,                                    -- "ES00 0000 0000 0000 0000 0000"
  -- Contacto operativo (publicable)
  contact_person_name  text,
  contact_person_phone text,
  -- Singleton enforcement
  is_singleton boolean not null default true unique check (is_singleton),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger club_settings_set_updated_at before update on club_settings
  for each row execute function set_updated_at();

-- Insert default row con datos de Club Padel les Coves (valores conocidos +
-- placeholders para los pendientes). El admin los completa desde el panel.
insert into club_settings (
  legal_name, cif, address, email,
  bizum_phone, iban,
  contact_person_name, contact_person_phone
) values (
  'Club Padel les Coves',
  null,                                                -- pendiente
  null,                                                -- pendiente
  'clubpadelvinroma@gmail.com',
  null,                                                -- pendiente
  null,                                                -- pendiente
  'Jonatan García',
  '+34 620 03 30 53'
)
on conflict (is_singleton) do nothing;

alter table club_settings enable row level security;
create policy "club_settings_public_read"
  on club_settings for select using (true);
create policy "club_settings_admin_write"
  on club_settings for all using (is_admin()) with check (is_admin());

-- -------------------------------------------------------------------------
-- Función: current_active_fee(tournament_id, at)
-- Devuelve el row de tournament_fees aplicable a la fecha dada.
-- Si la fecha cae fuera de todos los tramos default_open, devuelve el tramo
-- con is_default_open=false (recargo fuera de plazo). Si no hay match, NULL.
-- -------------------------------------------------------------------------
create or replace function current_active_fee(
  p_tournament_id uuid,
  p_at timestamptz default now()
)
returns tournament_fees
language sql
stable
as $$
  select *
  from tournament_fees
  where tournament_id = p_tournament_id
    and p_at >= starts_at
    and p_at <= ends_at
  order by is_default_open desc, starts_at asc
  limit 1;
$$;

-- -------------------------------------------------------------------------
-- Función: generate_payment_reference(pair_id, payer_player_id, mode)
-- Genera el concepto único determinístico para Bizum/transferencia.
-- Formato:
--   per_pair:   "2026-P<8 hex de pair_id>-<APELLIDO_NORMALIZADO>"
--   per_player: "2026-J<8 hex de player_id>-<APELLIDO_NORMALIZADO>"
-- -------------------------------------------------------------------------
create or replace function generate_payment_reference(
  p_pair_id uuid,
  p_payer_player_id uuid,
  p_mode fee_mode
)
returns text
language plpgsql
stable
as $$
declare
  v_year text;
  v_last_name text;
  v_id_short text;
  v_prefix text;
begin
  select year::text into v_year
  from tournaments t
  join pairs p on p.tournament_id = t.id
  where p.id = p_pair_id;

  select coalesce(upper(regexp_replace(last_name, '[^a-zA-Z]', '', 'g')), 'XXX')
  into v_last_name
  from players
  where id = p_payer_player_id;

  if p_mode = 'per_pair' then
    v_prefix := 'P';
    v_id_short := substring(p_pair_id::text from 1 for 8);
  else
    v_prefix := 'J';
    v_id_short := substring(p_payer_player_id::text from 1 for 8);
  end if;

  return v_year || '-' || v_prefix || v_id_short || '-' || substring(v_last_name from 1 for 12);
end;
$$;

-- -------------------------------------------------------------------------
-- Trigger: confirma la pareja cuando todos los pagos esperados están paid
-- -------------------------------------------------------------------------
create or replace function confirm_pair_if_all_paid()
returns trigger
language plpgsql
security definer
as $$
declare
  v_mode fee_mode;
  v_total_required int;
  v_paid_count int;
begin
  -- Sólo actúa cuando un pago pasa a 'paid'
  if NEW.status <> 'paid' then
    return NEW;
  end if;

  select fee_mode_chosen into v_mode from pairs where id = NEW.pair_id;

  v_total_required := case v_mode when 'per_pair' then 1 else 2 end;

  select count(*) into v_paid_count
  from payments
  where pair_id = NEW.pair_id and status = 'paid';

  if v_paid_count >= v_total_required then
    update pairs
    set status = 'confirmed'
    where id = NEW.pair_id and status <> 'confirmed';
  end if;

  return NEW;
end;
$$;

create trigger payments_confirm_pair
  after insert or update of status on payments
  for each row execute function confirm_pair_if_all_paid();

-- -------------------------------------------------------------------------
-- Índice adicional: lookup rápido por reference_code (pantalla de pago)
-- -------------------------------------------------------------------------
-- (reference_code ya es unique, así que el índice existe; añadimos un
-- índice parcial por status para la consulta del admin)
create index if not exists payments_pending_idx
  on payments (created_at desc)
  where status = 'pending';
