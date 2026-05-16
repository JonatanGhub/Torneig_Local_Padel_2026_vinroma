-- =========================================================================
-- 20260516120000_sprint4a_result_validation.sql
-- Sprint 4a — Validación cruzada de resultados (§25)
-- =========================================================================

set search_path = public;

create or replace function score_canonical(p_score jsonb)
returns text language sql immutable as $$
  select string_agg((s->>'a') || '-' || (s->>'b'), ',' order by (s->>'set')::int)
  from jsonb_array_elements(p_score) as s;
$$;

create or replace function score_winner(p_score jsonb, p_pair_a_id uuid, p_pair_b_id uuid)
returns uuid language plpgsql immutable as $$
declare
  v_sets_a int := 0; v_sets_b int := 0; v_set jsonb; v_a int; v_b int;
begin
  for v_set in select jsonb_array_elements(p_score) loop
    v_a := (v_set->>'a')::int; v_b := (v_set->>'b')::int;
    if v_a > v_b then v_sets_a := v_sets_a + 1;
    elsif v_b > v_a then v_sets_b := v_sets_b + 1;
    end if;
  end loop;
  if v_sets_a > v_sets_b then return p_pair_a_id;
  elsif v_sets_b > v_sets_a then return p_pair_b_id;
  else return null; end if;
end; $$;

create or replace function insert_sets_from_score(p_match_id uuid, p_score jsonb)
returns void language plpgsql security definer as $$
begin
  delete from sets where match_id = p_match_id;
  insert into sets (match_id, set_number, games_a, games_b)
  select p_match_id, (s->>'set')::int, (s->>'a')::int, (s->>'b')::int
  from jsonb_array_elements(p_score) as s;
end; $$;

create or replace function validate_match_on_report()
returns trigger language plpgsql security definer as $$
declare
  v_match record; v_admin_report record; v_report_a record; v_report_b record;
  v_count_captains int; v_winner uuid;
begin
  select m.id, m.pair_a_id, m.pair_b_id, m.status into v_match from matches m where m.id = NEW.match_id;
  if v_match.status = 'walkover' then return NEW; end if;

  select * into v_admin_report from match_reports
    where match_id = NEW.match_id and reporter_pair_side = 'admin'
    order by reported_at desc limit 1;
  if found then
    v_winner := score_winner(v_admin_report.score_json, v_match.pair_a_id, v_match.pair_b_id);
    perform insert_sets_from_score(NEW.match_id, v_admin_report.score_json);
    update matches set status = 'validated', winner_pair_id = v_winner where id = NEW.match_id;
    return NEW;
  end if;

  select * into v_report_a from match_reports
    where match_id = NEW.match_id and reporter_pair_side = 'a'
    order by reported_at desc limit 1;
  select * into v_report_b from match_reports
    where match_id = NEW.match_id and reporter_pair_side = 'b'
    order by reported_at desc limit 1;

  v_count_captains := (case when v_report_a is null then 0 else 1 end)
                    + (case when v_report_b is null then 0 else 1 end);

  if v_count_captains = 1 then
    update matches set status = 'pending_validation' where id = NEW.match_id;
  elsif v_count_captains = 2 then
    if score_canonical(v_report_a.score_json) = score_canonical(v_report_b.score_json) then
      v_winner := score_winner(v_report_a.score_json, v_match.pair_a_id, v_match.pair_b_id);
      perform insert_sets_from_score(NEW.match_id, v_report_a.score_json);
      update matches set status = 'validated', winner_pair_id = v_winner where id = NEW.match_id;
    else
      update matches set status = 'disputed' where id = NEW.match_id;
    end if;
  end if;
  return NEW;
end; $$;

create trigger match_reports_validate
  after insert or update on match_reports
  for each row execute function validate_match_on_report();

create or replace function submit_match_report(p_match_id uuid, p_score jsonb)
returns text language plpgsql security definer as $$
declare
  v_user_id uuid; v_player_id uuid; v_match record; v_side text; v_is_admin boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_is_admin := is_admin();
  select id into v_player_id from players where auth_user_id = v_user_id;
  if v_player_id is null and not v_is_admin then raise exception 'no_player_profile'; end if;
  select m.* into v_match from matches m where m.id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;

  if v_is_admin then
    v_side := 'admin';
    if v_player_id is null then raise exception 'admin_without_player_profile'; end if;
  else
    if exists (select 1 from pairs where id = v_match.pair_a_id and captain_id = v_player_id) then
      v_side := 'a';
    elsif exists (select 1 from pairs where id = v_match.pair_b_id and captain_id = v_player_id) then
      v_side := 'b';
    else
      raise exception 'not_captain_of_this_match';
    end if;
  end if;

  insert into match_reports (match_id, reporter_player_id, reporter_pair_side, score_json)
  values (p_match_id, v_player_id, v_side, p_score)
  on conflict (match_id, reporter_player_id)
  do update set score_json = excluded.score_json, reporter_pair_side = excluded.reporter_pair_side, reported_at = now();

  return v_side;
end; $$;

grant execute on function submit_match_report(uuid, jsonb) to authenticated;
