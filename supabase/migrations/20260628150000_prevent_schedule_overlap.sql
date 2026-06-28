-- =========================================================================
-- 20260628150000_prevent_schedule_overlap.sql
-- Evita solapaments d'horari a `matches`, sigui quin sigui el camí d'escriptura
-- (schedule_match d'admin, respond_to_reschedule entre capitans, bulk auto,
-- o SQL directe). Defensa a nivell de BD perquè no torni a passar.
-- =========================================================================
-- Regla 1 (pista): una pista no pot tenir dos partits a la mateixa hora.
-- Regla 2 (jugador): cap jugador pot jugar dos partits a la mateixa hora
--   (cobreix també qui estigui inscrit en dues categories).
--
-- El bug detectat: `respond_to_reschedule` actualitzava scheduled_at/court
-- sense validar res, de manera que dos canvis acceptats podien acabar a la
-- mateixa pista i hora (i amb una parella jugant els dos).
-- =========================================================================

set search_path = public;

create or replace function matches_prevent_overlap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_new_players uuid[];
begin
  -- Sense data no hi ha res a validar (sorteig, generació de quadre…).
  if NEW.scheduled_at is null then
    return NEW;
  end if;

  -- Només validem quan es fixa o canvia l'horari/pista (no en updates d'estat,
  -- resultat o walkover sobre un partit ja programat).
  if TG_OP = 'UPDATE'
     and NEW.scheduled_at is not distinct from OLD.scheduled_at
     and NEW.court_label is not distinct from OLD.court_label then
    return NEW;
  end if;

  -- Regla 1: conflicte de pista (mateixa pista + mateixa hora).
  if NEW.court_label is not null and exists (
    select 1
    from matches m
    where m.id <> NEW.id
      and m.tournament_id = NEW.tournament_id
      and m.scheduled_at = NEW.scheduled_at
      and m.court_label = NEW.court_label
  ) then
    raise exception 'court_double_booked'
      using hint = 'Aquesta pista ja té un partit a aquella hora.';
  end if;

  -- Regla 2: conflicte de jugador (algun dels 4 jugadors ja juga a aquella hora).
  select array[npa.player_a_id, npa.player_b_id, npb.player_a_id, npb.player_b_id]
    into v_new_players
  from pairs npa, pairs npb
  where npa.id = NEW.pair_a_id and npb.id = NEW.pair_b_id;

  if v_new_players is not null and exists (
    select 1
    from matches m
    join pairs ma on ma.id = m.pair_a_id
    join pairs mb on mb.id = m.pair_b_id
    where m.id <> NEW.id
      and m.tournament_id = NEW.tournament_id
      and m.scheduled_at = NEW.scheduled_at
      and array[ma.player_a_id, ma.player_b_id, mb.player_a_id, mb.player_b_id] && v_new_players
  ) then
    raise exception 'pair_double_booked'
      using hint = 'Alguna parella ja juga un altre partit a aquella hora.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists matches_prevent_overlap on matches;
create trigger matches_prevent_overlap
  before insert or update on matches
  for each row execute function matches_prevent_overlap();

-- =========================================================================
-- bulk_schedule_matches: ara és RESILIENT. Amb el trigger anterior, un sol
-- slot en conflicte feia abortar TOTA la desada d'horaris (i amb un error
-- sense traduir). Ara saltem les files que xoquen i retornem els ids
-- realment desats, perquè el progrés parcial es manté i només s'avisa els
-- capitans dels partits efectivament programats.
-- =========================================================================
drop function if exists bulk_schedule_matches(jsonb);

create function bulk_schedule_matches(p_assignments jsonb)
returns uuid[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_saved uuid[] := '{}';
  v_row   jsonb;
  v_id    uuid;
begin
  if not is_admin() then
    raise exception 'only_admin';
  end if;

  for v_row in select * from jsonb_array_elements(p_assignments)
  loop
    begin
      v_id := (v_row->>'match_id')::uuid;
      update matches
         set scheduled_at = (v_row->>'scheduled_at')::timestamptz,
             court_label  = v_row->>'court_label'
       where id = v_id;
      if found then
        v_saved := array_append(v_saved, v_id);
      end if;
    exception when others then
      -- Slot en conflicte (trigger matches_prevent_overlap) o fila invàlida:
      -- la saltem i continuem amb la resta.
      null;
    end;
  end loop;

  return v_saved;
end;
$$;

revoke execute on function bulk_schedule_matches(jsonb) from anon, public;
grant execute on function bulk_schedule_matches(jsonb) to authenticated;
