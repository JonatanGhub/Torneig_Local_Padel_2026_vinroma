-- =========================================================================
-- 20260703110000_admin_override_score.sql
-- Permet a l'admin entrar/corregir directament el marcador d'un partit
-- (p.ex. un error de transcripció en un resultat ja validat, o un partit
-- que necessita el marcador real sense passar pel doble report dels
-- capitans). A diferència de admin_set_walkover (marcador fix 6-0/6-0),
-- aquí l'admin introdueix el marcador real set a set.
-- =========================================================================

set search_path = public;

create or replace function admin_override_score(
  p_match_id uuid,
  p_score jsonb,
  p_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_match record;
  v_winner uuid;
begin
  if not is_admin() then raise exception 'only_admin'; end if;
  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;

  v_winner := score_winner(p_score, v_match.pair_a_id, v_match.pair_b_id);
  if v_winner is null then raise exception 'invalid_score'; end if;

  delete from match_reports where match_id = p_match_id;
  perform insert_sets_from_score(p_match_id, p_score);

  update matches
    set status = 'validated', winner_pair_id = v_winner
    where id = p_match_id;

  update match_reschedule_proposals
    set status = 'cancelled', responded_at = now()
    where match_id = p_match_id and status = 'pending';

  insert into audit_log (table_name, row_pk, operation, new_data, actor_id)
  values (
    'matches', p_match_id::text, 'UPDATE',
    jsonb_build_object(
      'status', 'validated',
      'winner_pair_id', v_winner,
      'admin_override_score', p_score,
      'admin_override_reason', p_reason
    ),
    auth.uid()
  );
end;
$$;

grant execute on function admin_override_score(uuid, jsonb, text) to authenticated;
