-- =========================================================================
-- 20260523130000_fix_run_draw_ambiguous_group_id.sql
-- Bugfix — run_draw fallaba SIEMPRE con:
--   ERROR 42702: column reference "group_id" is ambiguous
-- Causa: la firma `returns table (group_id uuid, ...)` crea una variable
-- PL/pgSQL `group_id` que colisiona con la columna `pairs.group_id` usada en
-- `... and group_id is null`. Con variable_conflict=error (por defecto), aborta.
-- Efecto: el sorteo nunca se podia ejecutar. Detectado en pruebas QA.
-- Solucion: directiva `#variable_conflict use_column` (las OUT vars solo se
-- rellenan posicionalmente en el RETURN QUERY final, nunca se referencian por
-- nombre, asi que preferir la columna es seguro).
-- =========================================================================

set search_path = public;

create or replace function run_draw(p_category_id uuid, p_seed integer default 0)
returns table (group_id uuid, group_label text, pair_count integer)
language plpgsql
security definer
as $$
#variable_conflict use_column
declare
  v_tournament_id uuid;
  v_pair_count    int;
  v_group_count   int;
  v_group_size    int;
  v_group_labels  text[] := array['A', 'B', 'C', 'D'];
  v_i             int;
  v_group_ids     uuid[];
  v_pair_record   record;
  v_position      int;
  v_target_group  int;
  v_match_a       uuid;
  v_match_b       uuid;
  v_count         int;
begin
  if not is_admin() then raise exception 'only_admin'; end if;

  select tournament_id into v_tournament_id from categories where id = p_category_id;
  if v_tournament_id is null then
    raise exception 'category_not_found';
  end if;

  select count(*) into v_pair_count
  from pairs
  where category_id = p_category_id
    and status = 'confirmed'
    and group_id is null;

  if v_pair_count < 4 then
    raise exception 'too_few_pairs (got %, need >= 4)', v_pair_count;
  end if;

  v_group_count := case
    when v_pair_count <= 6 then 1
    when v_pair_count <= 12 then 2
    when v_pair_count <= 18 then 3
    else 4
  end;

  v_group_ids := array[]::uuid[];
  for v_i in 1..v_group_count loop
    insert into groups (tournament_id, category_id, label, draw_seed, drawn_at)
    values (v_tournament_id, p_category_id, v_group_labels[v_i], p_seed, now())
    returning id into v_match_a;
    v_group_ids := array_append(v_group_ids, v_match_a);
  end loop;

  v_position := 0;
  for v_pair_record in
    select p.id
    from pairs p
    where p.category_id = p_category_id
      and p.status = 'confirmed'
      and p.group_id is null
    order by md5(p_seed::text || '-' || p.id::text)
  loop
    v_target_group := case
      when (v_position / v_group_count) % 2 = 0 then v_position % v_group_count
      else v_group_count - 1 - (v_position % v_group_count)
    end;

    update pairs
      set group_id = v_group_ids[v_target_group + 1]
      where id = v_pair_record.id;

    v_position := v_position + 1;
  end loop;

  for v_i in 1..v_group_count loop
    insert into matches (tournament_id, category_id, phase, group_label, pair_a_id, pair_b_id, status)
    select
      v_tournament_id,
      p_category_id,
      'group',
      v_group_labels[v_i],
      p1.id,
      p2.id,
      'scheduled'
    from pairs p1
    join pairs p2 on p1.group_id = p2.group_id and p1.id < p2.id
    where p1.group_id = v_group_ids[v_i];
  end loop;

  return query
    select g.id, g.label, count(p.id)::integer
    from groups g
    left join pairs p on p.group_id = g.id
    where g.category_id = p_category_id
    group by g.id, g.label
    order by g.label;
end;
$$;
