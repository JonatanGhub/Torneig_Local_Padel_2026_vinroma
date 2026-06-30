-- =========================================================================
-- 20260630100000_admin_accept_report.sql
-- Permet a l'admin acceptar un dels reports d'una disputa (o l'únic report
-- pendent) i validar el resultat del partit amb aquell marcador.
-- =========================================================================

set search_path = public;

create or replace function admin_accept_report(
  p_match_id uuid,
  p_side     text   -- 'a' | 'b'
) returns void
language plpgsql
security definer
as $$
declare
  v_match  record;
  v_report record;
  v_winner uuid;
begin
  if not is_admin() then raise exception 'only_admin'; end if;
  if p_side not in ('a', 'b') then raise exception 'invalid_side'; end if;

  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status not in ('disputed', 'pending_validation') then
    raise exception 'match_not_resolvable';
  end if;

  select * into v_report
  from match_reports
  where match_id = p_match_id and reporter_pair_side = p_side
  order by reported_at desc limit 1;
  if not found then raise exception 'report_not_found'; end if;

  v_winner := score_winner(v_report.score_json, v_match.pair_a_id, v_match.pair_b_id);

  perform insert_sets_from_score(p_match_id, v_report.score_json);

  update matches
  set status = 'validated', winner_pair_id = v_winner, updated_at = now()
  where id = p_match_id;

  insert into audit_log (table_name, row_pk, operation, new_data, actor_id)
  values (
    'matches', p_match_id::text, 'UPDATE',
    jsonb_build_object(
      'status', 'validated',
      'winner_pair_id', v_winner,
      'accepted_report_side', p_side
    ),
    auth.uid()
  );
end;
$$;

grant execute on function admin_accept_report(uuid, text) to authenticated;
