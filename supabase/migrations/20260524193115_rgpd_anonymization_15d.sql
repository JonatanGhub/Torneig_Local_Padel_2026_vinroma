-- =========================================================================
-- 20260524193115_rgpd_anonymization_15d.sql
-- Anonimización RGPD de datos personales 15 días después de la final.
-- =========================================================================
-- Por cada torneo con final_at + 15 días < now(), anonimiza los players
-- implicados (nombre, email, teléfono, datos del tutor legal y contacto de
-- emergencia). Se programa con pg_cron a las 03:00 cada día.
-- =========================================================================

set search_path = public;

create or replace function public.anonymize_finished_tournaments()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count int;
begin
  with finished as (
    select id from tournaments where final_at + interval '15 days' < now()
  ),
  target_players as (
    select distinct pl.id
    from players pl
    join pairs p on pl.id in (p.player_a_id, p.player_b_id)
    where p.tournament_id in (select id from finished)
      and pl.is_anonymized = false
  )
  update players pl set
    first_name = null,
    last_name = null,
    email = null,
    phone = null,
    birth_date = null,
    legal_guardian_name = null,
    legal_guardian_dni = null,
    legal_guardian_phone = null,
    legal_guardian_email = null,
    emergency_contact_name = null,
    emergency_contact_phone = null,
    is_anonymized = true,
    anonymized_at = now()
  where pl.id in (select id from target_players);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cron diario a las 03:00. Guardado para no fallar si pg_cron no está
-- disponible en un entorno local de desarrollo.
create extension if not exists pg_cron;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'schedule'
  ) then
    if exists (select 1 from cron.job where jobname = 'rgpd-anonymize-15d') then
      perform cron.unschedule('rgpd-anonymize-15d');
    end if;
    perform cron.schedule(
      'rgpd-anonymize-15d',
      '0 3 * * *',
      'select public.anonymize_finished_tournaments();'
    );
  end if;
end $$;
