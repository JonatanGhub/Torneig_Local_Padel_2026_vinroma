-- =========================================================================
-- 20260516150000_sprint4d_admin_walkover.sql
-- Sprint 4d — Resolución manual de partidos por incomparecencia (walkover)
-- =========================================================================

set search_path = public;

create or replace function admin_set_walkover(
  p_match_id uuid,
  p_winner_pair_id uuid,
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
  if p_winner_pair_id <> v_match.pair_a_id and p_winner_pair_id <> v_match.pair_b_id then
    raise exception 'invalid_winner';
  end if;

  delete from match_reports where match_id = p_match_id;
  delete from sets where match_id = p_match_id;

  insert into sets (match_id, set_number, games_a, games_b) values
    (p_match_id, 1,
     case when p_winner_pair_id = v_match.pair_a_id then 6 else 0 end,
     case when p_winner_pair_id = v_match.pair_a_id then 0 else 6 end),
    (p_match_id, 2,
     case when p_winner_pair_id = v_match.pair_a_id then 6 else 0 end,
     case when p_winner_pair_id = v_match.pair_a_id then 0 else 6 end);

  update matches
    set status = 'walkover', winner_pair_id = p_winner_pair_id
    where id = p_match_id;

  update match_reschedule_proposals
    set status = 'cancelled', responded_at = now()
    where match_id = p_match_id and status = 'pending';

  insert into audit_log (table_name, row_pk, operation, new_data, actor_id)
  values (
    'matches', p_match_id::text, 'UPDATE',
    jsonb_build_object('status','walkover','winner_pair_id',p_winner_pair_id,'reason',p_reason),
    auth.uid()
  );
end;
$$;

grant execute on function admin_set_walkover(uuid, uuid, text) to authenticated;
