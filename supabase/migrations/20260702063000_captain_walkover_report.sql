-- =========================================================================
-- 20260702063000_captain_walkover_report.sql
-- Permet a un capità reportar un walkover (retirada/lesió o incompareixença)
-- sense necessitat que l'admin hi intervingui, per als casos en què el
-- partit s'interromp abans que ningú hagi pogut reportar un marcador vàlid
-- (p.ex. una lesió a mig partit deixa un set incomplet que no es pot validar
-- amb submit_match_report, ja que exigeix sets complets vàlids de pàdel).
--
-- Disseny: el capità NO introdueix cap marcador, només indica qui s'ha
-- retirat ('we_retired' | 'rival_retired'). Això evita el problema que
-- score_json normalment es desa en termes RELATIUS al capità que reporta
-- ("nosaltres"/"ells"), la qual cosa faria que comparar dos reports fos
-- ambigu. Aquí calculem el guanyador en termes ABSOLUTS (pair_a/pair_b)
-- abans de desar-lo, així que dos reports que hi estiguin d'acord sempre
-- coincidiran textualment i el trigger existent (validate_match_on_report)
-- els validarà sense haver de tocar-lo.
-- =========================================================================

set search_path = public;

create or replace function submit_match_walkover_report(
  p_match_id uuid,
  p_claim text -- 'we_retired' | 'rival_retired'
)
returns text
language plpgsql
security definer
as $$
declare
  v_user_id      uuid;
  v_player_id    uuid;
  v_match        record;
  v_side         text;
  v_winner_side  text;
  v_score        jsonb;
begin
  if p_claim not in ('we_retired', 'rival_retired') then
    raise exception 'invalid_claim';
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

  -- Marcador placeholder (igual convenció que admin_set_walkover) amb un
  -- marcador "wo" perquè les notificacions i el propi trigger puguin
  -- distingir-ho d'un 6-0/6-0 real reportat normalment.
  if v_winner_side = 'a' then
    v_score := '[{"set":1,"a":6,"b":0,"wo":true},{"set":2,"a":6,"b":0,"wo":true}]'::jsonb;
  else
    v_score := '[{"set":1,"a":0,"b":6,"wo":true},{"set":2,"a":0,"b":6,"wo":true}]'::jsonb;
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

grant execute on function submit_match_walkover_report(uuid, text) to authenticated;
