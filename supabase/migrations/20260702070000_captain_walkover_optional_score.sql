-- =========================================================================
-- 20260702070000_captain_walkover_optional_score.sql
-- Afegeix un marcador parcial OPCIONAL i purament informatiu al report de
-- walkover (p.ex. "anàvem 1 set a 1, 2-0 al segon quan s'ha retirat").
--
-- Important: aquest marcador NO afecta en cap cas qui guanya (ho decideix
-- exclusivament p_claim, com fins ara) ni la comparació que valida si els
-- dos capitans hi estan d'acord (que segueix basant-se únicament en el
-- placeholder 6-0/6-0 per bàndol absolut). Així dues reclamacions de
-- walkover que coincideixin en qui s'ha retirat sempre es validaran, encara
-- que cadascú recordi (o ompli) el marcador parcial de manera diferent.
--
-- Es desa com a "wo_real_score" dins del primer element del placeholder,
-- en termes ABSOLUTS (pair_a/pair_b) igual que la resta del marcador. El
-- capità l'introdueix en termes relatius ("nosaltres"/"ells", com al
-- formulari normal) i aquí es capgira si cal.
-- =========================================================================

set search_path = public;

-- Cal esborrar la versió de 2 arguments explícitament: amb el nou paràmetre
-- per defecte, una crida amb 2 arguments seria ambigua entre totes dues.
drop function if exists submit_match_walkover_report(uuid, text);

create or replace function submit_match_walkover_report(
  p_match_id uuid,
  p_claim text, -- 'we_retired' | 'rival_retired'
  p_real_score jsonb default null -- opcional: [{"set":1,"a":6,"b":4}, ...] relatiu al capità
)
returns text
language plpgsql
security definer
as $$
declare
  v_user_id         uuid;
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

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id into v_player_id from players where auth_user_id = v_user_id;
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

  if exists (select 1 from pairs where id = v_match.pair_a_id and captain_id = v_player_id) then
    v_side := 'a';
  elsif exists (select 1 from pairs where id = v_match.pair_b_id and captain_id = v_player_id) then
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

  -- Marcador placeholder (igual convenció que admin_set_walkover) amb un
  -- marcador "wo" perquè les notificacions i el propi trigger puguin
  -- distingir-ho d'un 6-0/6-0 real reportat normalment.
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
