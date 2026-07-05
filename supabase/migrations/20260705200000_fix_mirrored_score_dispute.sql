-- =========================================================================
-- 20260705200000_fix_mirrored_score_dispute.sql
-- Arregla un fals positiu de "disputed": el trigger comparava
-- score_canonical(report_a) amb score_canonical(report_b) tal qual, però
-- cada capità desa el seu marcador relatiu a SI MATEIX ("a"=el seu equip,
-- "b"=el rival) — el report del capità B és, per tant, el MIRALL del
-- report del capità A quan ambdós descriuen el mateix resultat real. Dos
-- capitans que informen honestament el mateix resultat acabaven marcats
-- com "disputed" perquè "6-0,6-2" ≠ "0-6,2-6" com a text literal.
--
-- Cas real confirmat (5/7/2026): Jesus/Miquel guanyen 6-0,6-2; Joan Carles
-- ho confirma correctament des del seu punt de vista (el seu equip perd
-- 0-6,2-6) — el partit va quedar "disputed" tot i que els dos capitans
-- estaven d'acord.
-- =========================================================================

set search_path = public;

-- -------------------------------------------------------------------------
-- Helper: capgira els camps a/b de cada set d'un marcador (mateixa
-- transformació que lib/*/flipScore() al codi de l'app). Només té sentit
-- aplicar-la a reports NORMALS — els walkovers ja es desen en termes
-- absoluts (pair_a/pair_b), no relatius al capità.
-- =========================================================================
create or replace function score_flip(p_score jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_agg(
    jsonb_build_object(
      'set', (s->>'set')::int,
      'a', (s->>'b')::int,
      'b', (s->>'a')::int
    )
    order by (s->>'set')::int
  )
  from jsonb_array_elements(p_score) as s;
$$;

create or replace function validate_match_on_report()
returns trigger
language plpgsql
security definer
as $$
declare
  v_match           record;
  v_admin_report    record;
  v_report_a        record;
  v_report_b        record;
  v_count_captains  int;
  v_winner          uuid;
  v_a_is_wo         boolean;
  v_b_is_wo         boolean;
  v_reports_match   boolean;
begin
  select m.id, m.pair_a_id, m.pair_b_id, m.status into v_match
  from matches m where m.id = NEW.match_id;

  if v_match.status = 'walkover' then
    -- Walkover es estado terminal manual; no se toca con reports.
    return NEW;
  end if;

  -- Caso 1: report de admin → terminal
  select * into v_admin_report from match_reports
    where match_id = NEW.match_id and reporter_pair_side = 'admin'
    order by reported_at desc limit 1;

  if found then
    v_winner := score_winner(v_admin_report.score_json, v_match.pair_a_id, v_match.pair_b_id);
    perform insert_sets_from_score(NEW.match_id, v_admin_report.score_json);
    update matches
      set status = 'validated', winner_pair_id = v_winner
      where id = NEW.match_id;
    return NEW;
  end if;

  -- Caso 2: contar reports de capitanes
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
    v_a_is_wo := coalesce((v_report_a.score_json->0->>'wo')::boolean, false);
    v_b_is_wo := coalesce((v_report_b.score_json->0->>'wo')::boolean, false);

    if v_a_is_wo or v_b_is_wo then
      -- Walkover: ja desat en termes absoluts (pair_a/pair_b) als dos
      -- costats — comparació directa, sense capgirar.
      v_reports_match := score_canonical(v_report_a.score_json) = score_canonical(v_report_b.score_json);
    else
      -- Reports normals: cadascú es desa relatiu a qui reporta (mirall
      -- l'un de l'altre quan descriuen el mateix resultat) — cal capgirar
      -- el del costat B a termes absoluts abans de comparar.
      v_reports_match := score_canonical(v_report_a.score_json) = score_canonical(score_flip(v_report_b.score_json));
    end if;

    if v_reports_match then
      v_winner := score_winner(v_report_a.score_json, v_match.pair_a_id, v_match.pair_b_id);
      perform insert_sets_from_score(NEW.match_id, v_report_a.score_json);
      update matches
        set status = 'validated', winner_pair_id = v_winner
        where id = NEW.match_id;
    else
      update matches set status = 'disputed' where id = NEW.match_id;
    end if;
  end if;

  return NEW;
end;
$$;

-- -------------------------------------------------------------------------
-- Backfill: reavalua els partits que ja estan "disputed" amb la lògica nova
-- (capgirant el report B abans de comparar). Els que eren un fals positiu
-- (mateix resultat real, mirall l'un de l'altre) queden validats ara
-- mateix; els que són una discrepància real es queden tal com estaven.
-- =========================================================================
do $$
declare
  v_row record;
  v_a_is_wo boolean;
  v_b_is_wo boolean;
  v_match_ok boolean;
  v_winner uuid;
begin
  for v_row in
    select m.id as match_id, m.pair_a_id, m.pair_b_id,
           ra.score_json as a_json, rb.score_json as b_json
    from matches m
    join match_reports ra on ra.match_id = m.id and ra.reporter_pair_side = 'a'
    join match_reports rb on rb.match_id = m.id and rb.reporter_pair_side = 'b'
    where m.status = 'disputed'
  loop
    v_a_is_wo := coalesce((v_row.a_json->0->>'wo')::boolean, false);
    v_b_is_wo := coalesce((v_row.b_json->0->>'wo')::boolean, false);

    if v_a_is_wo or v_b_is_wo then
      v_match_ok := score_canonical(v_row.a_json) = score_canonical(v_row.b_json);
    else
      v_match_ok := score_canonical(v_row.a_json) = score_canonical(score_flip(v_row.b_json));
    end if;

    if v_match_ok then
      v_winner := score_winner(v_row.a_json, v_row.pair_a_id, v_row.pair_b_id);
      perform insert_sets_from_score(v_row.match_id, v_row.a_json);
      update matches
        set status = 'validated', winner_pair_id = v_winner
        where id = v_row.match_id;
    end if;
  end loop;
end $$;
