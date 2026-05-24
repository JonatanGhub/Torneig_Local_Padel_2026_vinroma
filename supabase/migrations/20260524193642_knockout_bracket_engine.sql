-- =========================================================================
-- 20260524193642_knockout_bracket_engine.sql
-- Motor del cuadro eliminatorio (knockout) + consolación.
-- =========================================================================
-- Fases en matches.phase:
--   'group'            round-robin de grupos (sprint 3)
--   'ko_1','ko_2',...   cuadro principal (1.º y 2.º de cada grupo)
--   'cons_1','cons_2'   cuadro de consolación (3.º en adelante)
-- matches.group_label se reutiliza como número de partido dentro de la ronda.
--
-- generate_knockout(category): siembra la ronda 1 (admin only, fase de grupos
--   terminada, tamaños potencia de dos).
-- advance_knockout(): trigger AFTER UPDATE que, al cerrarse todos los partidos
--   de una ronda, crea la siguiente emparejando ganadores consecutivos.
-- =========================================================================

set search_path = public;

create or replace function public.generate_knockout(p_category_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tour uuid;
  v_groups int;
  v_unfinished int;
  v_main_n int;
  v_cons_n int;
begin
  if not is_admin() then raise exception 'only_admin'; end if;

  select tournament_id into v_tour from categories where id = p_category_id;
  if v_tour is null then raise exception 'category_not_found'; end if;

  select count(*) into v_groups from groups where category_id = p_category_id;
  if v_groups = 0 then raise exception 'draw_not_done'; end if;

  select count(*) into v_unfinished from matches
   where category_id = p_category_id and phase = 'group'
     and status not in ('validated', 'walkover');
  if v_unfinished > 0 then raise exception 'group_phase_not_finished'; end if;

  if exists (select 1 from matches where category_id = p_category_id and phase ~ '^(ko|cons)_') then
    raise exception 'knockout_already_generated';
  end if;

  select
    count(*) filter (where grp_rank <= 2),
    count(*) filter (where grp_rank >= 3)
  into v_main_n, v_cons_n
  from (
    select row_number() over (
             partition by s.group_id
             order by s.matches_won desc, s.sets_diff desc, s.games_diff desc
           ) as grp_rank
    from category_standings s
    where s.category_id = p_category_id
  ) r;

  if v_main_n < 2 or (v_main_n & (v_main_n - 1)) <> 0 then
    raise exception 'main_bracket_needs_power_of_two (got %)', v_main_n;
  end if;

  with ranked as (
    select s.pair_id, g.label as glabel,
      row_number() over (partition by s.group_id
        order by s.matches_won desc, s.sets_diff desc, s.games_diff desc) as grp_rank
    from category_standings s
    join groups g on g.id = s.group_id
    where s.category_id = p_category_id
  ),
  seeds as (
    select pair_id, row_number() over (order by grp_rank, glabel) as seed
    from ranked where grp_rank <= 2
  )
  insert into matches (tournament_id, category_id, phase, group_label, pair_a_id, pair_b_id, status)
  select v_tour, p_category_id, 'ko_1', k::text, a.pair_id, b.pair_id, 'scheduled'
  from generate_series(1, v_main_n / 2) k
  join seeds a on a.seed = k
  join seeds b on b.seed = v_main_n + 1 - k;

  if v_cons_n >= 2 then
    if (v_cons_n & (v_cons_n - 1)) <> 0 then
      raise exception 'consolation_bracket_needs_power_of_two (got %)', v_cons_n;
    end if;
    with ranked as (
      select s.pair_id, g.label as glabel,
        row_number() over (partition by s.group_id
          order by s.matches_won desc, s.sets_diff desc, s.games_diff desc) as grp_rank
      from category_standings s
      join groups g on g.id = s.group_id
      where s.category_id = p_category_id
    ),
    seeds as (
      select pair_id, row_number() over (order by grp_rank, glabel) as seed
      from ranked where grp_rank >= 3
    )
    insert into matches (tournament_id, category_id, phase, group_label, pair_a_id, pair_b_id, status)
    select v_tour, p_category_id, 'cons_1', k::text, a.pair_id, b.pair_id, 'scheduled'
    from generate_series(1, v_cons_n / 2) k
    join seeds a on a.seed = k
    join seeds b on b.seed = v_cons_n + 1 - k;
  end if;

  return format('main=%s cons=%s', v_main_n, v_cons_n);
end;
$$;

create or replace function public.advance_knockout()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bracket text;
  v_round int;
  v_pending int;
  v_winners uuid[];
  v_next text;
  v_n int;
  k int;
begin
  if NEW.status not in ('validated', 'walkover') or NEW.winner_pair_id is null then
    return NEW;
  end if;
  if NEW.phase !~ '^(ko|cons)_[0-9]+$' then
    return NEW;
  end if;

  v_bracket := split_part(NEW.phase, '_', 1);
  v_round := split_part(NEW.phase, '_', 2)::int;

  select count(*) filter (where status not in ('validated', 'walkover') or winner_pair_id is null)
    into v_pending
  from matches where category_id = NEW.category_id and phase = NEW.phase;
  if v_pending > 0 then return NEW; end if;

  select array_agg(winner_pair_id order by group_label::int) into v_winners
  from matches where category_id = NEW.category_id and phase = NEW.phase;

  v_n := array_length(v_winners, 1);
  if v_n <= 1 then return NEW; end if;

  v_next := v_bracket || '_' || (v_round + 1);
  if exists (select 1 from matches where category_id = NEW.category_id and phase = v_next) then
    return NEW;
  end if;

  for k in 1..(v_n / 2) loop
    insert into matches (tournament_id, category_id, phase, group_label, pair_a_id, pair_b_id, status)
    values (NEW.tournament_id, NEW.category_id, v_next, k::text, v_winners[2 * k - 1], v_winners[2 * k], 'scheduled');
  end loop;

  return NEW;
end;
$$;

drop trigger if exists matches_advance_knockout on public.matches;
create trigger matches_advance_knockout
  after update on public.matches
  for each row execute function public.advance_knockout();
