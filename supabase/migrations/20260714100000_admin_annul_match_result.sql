-- =========================================================================
-- 20260714100000_admin_annul_match_result.sql
-- Permet a l'admin anul·lar el resultat d'un partit ja jugat (validated,
-- walkover, disputed o pending_validation) i tornar-lo a l'estat "per jugar":
-- s'esborren els reports i sets, es buida el guanyador, i el partit torna a
-- 'scheduled'. Opcionalment l'admin pot fixar-hi ja una nova data/pista en el
-- mateix pas; si no, el partit queda sense programar i qualsevol dels dos
-- capitans el pot reprogramar des del seu propi flux de "proposar canvi de
-- data" (propose_reschedule), que ja funciona sobre partits en 'scheduled'.
-- =========================================================================

set search_path = public;

create or replace function admin_annul_match_result(
  p_match_id uuid,
  p_new_scheduled_at timestamptz default null,
  p_new_court_label text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_match record;
begin
  if not is_admin() then raise exception 'only_admin'; end if;

  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status = 'scheduled' then raise exception 'match_not_played'; end if;
  if p_new_scheduled_at is not null and p_new_scheduled_at <= now() then
    raise exception 'new_date_must_be_future';
  end if;

  delete from match_reports where match_id = p_match_id;
  delete from sets where match_id = p_match_id;

  update match_reschedule_proposals
    set status = 'cancelled', responded_at = now()
    where match_id = p_match_id and status = 'pending';

  -- Sense nova data: es deixa totalment sense programar (data i pista a
  -- null) perquè no quedi un rastre confús d'una hora passada que ja no és
  -- vàlida; amb nova data, es fixa també la pista indicada (el trigger
  -- matches_prevent_overlap valida que no xoqui amb cap altre partit).
  update matches
    set status = 'scheduled',
        winner_pair_id = null,
        reminder_sent_at = null,
        scheduled_at = p_new_scheduled_at,
        court_label = case when p_new_scheduled_at is not null then p_new_court_label else null end
    where id = p_match_id;

  insert into audit_log (table_name, row_pk, operation, new_data, actor_id)
  values (
    'matches', p_match_id::text, 'UPDATE',
    jsonb_build_object(
      'action', 'admin_annul_match_result',
      'previous_status', v_match.status,
      'new_scheduled_at', p_new_scheduled_at,
      'new_court_label', p_new_court_label,
      'reason', p_reason
    ),
    auth.uid()
  );
end;
$$;

revoke execute on function admin_annul_match_result(uuid, timestamptz, text, text) from anon, public;
grant execute on function admin_annul_match_result(uuid, timestamptz, text, text) to authenticated;
