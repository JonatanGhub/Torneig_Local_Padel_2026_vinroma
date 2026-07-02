-- =========================================================================
-- 20260702101500_captain_walkover_email_identity.sql
-- Fix: submit_match_walkover_report buscava el jugador NOMÉS per
-- auth_user_id, però la identitat de capità d'aquest torneig és per CORREU
-- (veure 20260601150000_captain_email_identity.sql): molts capitans no
-- tenen cap fila de players amb auth_user_id i el walkover fallava amb
-- 'no_player_profile' encara que el report normal els funcionés.
--
-- S'adopta exactament la mateixa resolució que submit_match_report:
--   current_player_id()  → player canònic (auth_user_id o correu)
--   is_captain_of(pair)  → capità per qualsevol dels seus player ids
-- =========================================================================

set search_path = public;

create or replace function submit_match_walkover_report(
  p_match_id uuid,
  p_claim text, -- 'we_retired' | 'rival_retired'
  p_real_score jsonb default null -- opcional: [{"set":1,"a":6,"b":4}, ...] relatiu al capità
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id       uuid;
  v_match           record;
  v_side            text;
  v_winner_side     text;
  v_score           jsonb;
  v_real_score_abs  jsonb;
begin
  if p_claim not in ('we_retired', 'rival_retired') then
    raise exception 'invalid_claim';
  end if;

  if p_real_score is not null and jsonb_array_length(p_real_score) > 3 then
    raise exception 'invalid_real_score';
  end if;

  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  v_player_id := current_player_id();
  if v_player_id is null then
    raise exception 'no_player_profile';
  end if;

  select m.* into v_match from matches m where m.id = p_match_id;
  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.status in ('validated', 'walkover') then
    raise exception 'match_already_resolved';
  end if;

  if is_captain_of(v_match.pair_a_id) then
    v_side := 'a';
  elsif is_captain_of(v_match.pair_b_id) then
    v_side := 'b';
  else
    raise exception 'not_captain_of_this_match';
  end if;

  -- Guanyador en termes ABSOLUTS (pair_a/pair_b), no relatius al capità.
  if (p_claim = 'we_retired' and v_side = 'a') or (p_claim = 'rival_retired' and v_side = 'b') then
    v_winner_side := 'b';
  else
    v_winner_side := 'a';
  end if;

  -- Marcador parcial opcional: el capità l'entra com "nosaltres"/"ells";
  -- el capgirem a absolut pair_a/pair_b si el capità és el costat b.
  if p_real_score is not null then
    select jsonb_agg(
      jsonb_build_object(
        'set', (s->>'set')::int,
        'a', greatest(0, least(7, case when v_side = 'a' then (s->>'a')::int else (s->>'b')::int end)),
        'b', greatest(0, least(7, case when v_side = 'a' then (s->>'b')::int else (s->>'a')::int end))
      )
      order by (s->>'set')::int
    )
    into v_real_score_abs
    from jsonb_array_elements(p_real_score) as s;
  end if;

  if v_winner_side = 'a' then
    v_score := '[{"set":1,"a":6,"b":0,"wo":true},{"set":2,"a":6,"b":0,"wo":true}]'::jsonb;
  else
    v_score := '[{"set":1,"a":0,"b":6,"wo":true},{"set":2,"a":0,"b":6,"wo":true}]'::jsonb;
  end if;

  if v_real_score_abs is not null then
    v_score := jsonb_set(v_score, '{0,wo_real_score}', v_real_score_abs);
  end if;

  insert into match_reports (match_id, reporter_player_id, reporter_pair_side, score_json)
  values (p_match_id, v_player_id, v_side, v_score)
  on conflict (match_id, reporter_player_id)
  do update set score_json = excluded.score_json, reporter_pair_side = excluded.reporter_pair_side, reported_at = now();

  -- Si el trigger ha validat el partit (els dos reports coincideixen) i
  -- AMBDÓS reports són walkover, ho marquem com a 'walkover' en lloc de
  -- 'validated' perquè quedi clar que no es va acabar de jugar.
  update matches m
  set status = 'walkover'
  where m.id = p_match_id
    and m.status = 'validated'
    and (
      select bool_and(coalesce((mr.score_json->0->>'wo')::boolean, false))
      from match_reports mr
      where mr.match_id = p_match_id and mr.reporter_pair_side in ('a', 'b')
    ) is true;

  return v_side;
end;
$$;

grant execute on function submit_match_walkover_report(uuid, text, jsonb) to authenticated;
