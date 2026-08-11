-- =========================================================================
-- 20260811230000_rgpd_anonymization_30d.sql
-- Alinea la finestra d'anonimització RGPD amb el que PROMETEN el reglament
-- i la política de privacitat publicats: 30 dies després de la final (la
-- funció original ho feia als 15 dies). Amb la final del 7 d'agost, les
-- dades personals s'anonimitzen la matinada del 7 de setembre de 2026.
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
    select id from tournaments where final_at + interval '30 days' < now()
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

-- Reprograma el job de pg_cron amb el nom nou (i retira l'antic de 15d).
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
    if exists (select 1 from cron.job where jobname = 'rgpd-anonymize-30d') then
      perform cron.unschedule('rgpd-anonymize-30d');
    end if;
    perform cron.schedule(
      'rgpd-anonymize-30d',
      '0 3 * * *',
      'select public.anonymize_finished_tournaments();'
    );
  end if;
end $$;
