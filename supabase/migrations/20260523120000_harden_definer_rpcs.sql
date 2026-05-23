-- =========================================================================
-- 20260523120000_harden_definer_rpcs.sql
-- Hardening — anade control de acceso admin a funciones SECURITY DEFINER que
-- estaban expuestas al rol anon/authenticated sin comprobacion interna.
-- =========================================================================
-- Detectado por el linter de Supabase (anon_security_definer_function_executable):
--   - run_draw / reset_draw / schedule_match: cualquiera podia sortear,
--     deshacer el sorteo o reprogramar partidos llamando al endpoint REST.
--   - insert_sets_from_score: helper interno; podia sobrescribir resultados.
-- Solucion: guarda is_admin() interna + REVOKE de anon (defensa en profundidad).
-- Las funciones se invocan desde el panel admin con el cliente autenticado del
-- usuario (no service role), por lo que la guarda is_admin() es suficiente para
-- el flujo legitimo (el admin tiene app_metadata.role='admin').
-- =========================================================================

set search_path = public;

-- -------------------------------------------------------------------------
-- run_draw: ahora exige admin
-- -------------------------------------------------------------------------
create or replace function run_draw(p_category_id uuid, p_seed integer default 0)
returns table (group_id uuid, group_label text, pair_count integer)
language plpgsql
security definer
as $$
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

  -- Validacion: existe la categoria?
  select tournament_id into v_tournament_id from categories where id = p_category_id;
  if v_tournament_id is null then
    raise exception 'category_not_found';
  end if;

  -- Cuenta pairs confirmed sin grupo
  select count(*) into v_pair_count
  from pairs
  where category_id = p_category_id
    and status = 'confirmed'
    and group_id is null;

  if v_pair_count < 4 then
    raise exception 'too_few_pairs (got %, need >= 4)', v_pair_count;
  end if;

  -- Decide cuantos grupos
  v_group_count := case
    when v_pair_count <= 6 then 1
    when v_pair_count <= 12 then 2
    when v_pair_count <= 18 then 3
    else 4
  end;

  -- Crea los grupos
  v_group_ids := array[]::uuid[];
  for v_i in 1..v_group_count loop
    insert into groups (tournament_id, category_id, label, draw_seed, drawn_at)
    values (v_tournament_id, p_category_id, v_group_labels[v_i], p_seed, now())
    returning id into v_match_a;
    v_group_ids := array_append(v_group_ids, v_match_a);
  end loop;

  -- Asigna pairs a grupos con distribucion serpiente
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

  -- Genera matches round-robin dentro de cada grupo (todos contra todos)
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

  -- Devuelve resumen
  return query
    select g.id, g.label, count(p.id)::integer
    from groups g
    left join pairs p on p.group_id = g.id
    where g.category_id = p_category_id
    group by g.id, g.label
    order by g.label;
end;
$$;

-- -------------------------------------------------------------------------
-- reset_draw: ahora exige admin
-- -------------------------------------------------------------------------
create or replace function reset_draw(p_category_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_locked_count int;
  v_deleted      int;
begin
  if not is_admin() then raise exception 'only_admin'; end if;

  -- No permitir si hay matches con resultado consignado
  select count(*) into v_locked_count
  from matches
  where category_id = p_category_id
    and status in ('validated', 'disputed', 'walkover');

  if v_locked_count > 0 then
    raise exception 'cannot_reset_with_locked_matches (% matches already resolved)', v_locked_count;
  end if;

  -- Borra matches de la categoria (solo en fase grupos por ahora)
  delete from matches where category_id = p_category_id and phase = 'group';
  get diagnostics v_deleted = row_count;

  -- Limpia group_id en pairs
  update pairs set group_id = null where category_id = p_category_id;

  -- Borra los groups
  delete from groups where category_id = p_category_id;

  return v_deleted;
end;
$$;

-- -------------------------------------------------------------------------
-- schedule_match: convertida a plpgsql con guarda admin
-- -------------------------------------------------------------------------
create or replace function schedule_match(
  p_match_id uuid,
  p_scheduled_at timestamptz,
  p_court_label text
)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'only_admin'; end if;
  update matches
  set scheduled_at = p_scheduled_at,
      court_label = p_court_label
  where id = p_match_id;
end;
$$;

-- -------------------------------------------------------------------------
-- Grants: defensa en profundidad. insert_sets_from_score es helper interno
-- (lo llama el trigger validate_match_on_report, que corre como owner), asi
-- que se revoca su ejecucion directa por completo.
-- -------------------------------------------------------------------------
revoke execute on function insert_sets_from_score(uuid, jsonb) from anon, authenticated, public;

revoke execute on function run_draw(uuid, integer) from anon, public;
grant execute on function run_draw(uuid, integer) to authenticated;

revoke execute on function reset_draw(uuid) from anon, public;
grant execute on function reset_draw(uuid) to authenticated;

revoke execute on function schedule_match(uuid, timestamptz, text) from anon, public;
grant execute on function schedule_match(uuid, timestamptz, text) to authenticated;
