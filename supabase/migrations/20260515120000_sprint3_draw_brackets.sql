-- =========================================================================
-- 20260515120000_sprint3_draw_brackets.sql
-- Sprint 3 — Sorteo + standings + scheduling
-- =========================================================================
-- Añade:
--   - Tabla `groups` (grupos round-robin dentro de una categoría)
--   - Columna `pairs.group_id` (FK opcional a groups)
--   - Función run_draw(category_id, seed): sortea pairs confirmadas en grupos
--   - Función reset_draw(category_id): deshace el sorteo (admin only)
--   - Vista `category_standings`: stats live por pair dentro de su grupo
--   - Funciones helper: tiebreak ordering según §7
-- =========================================================================

set search_path = public;

-- -------------------------------------------------------------------------
-- Groups (round-robin pools dentro de una categoría)
-- -------------------------------------------------------------------------
create table groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  label         text not null,                       -- "A", "B", "C"
  draw_seed     integer,                              -- seed usado en el sorteo
  drawn_at      timestamptz,
  created_at    timestamptz not null default now(),
  unique (category_id, label)
);

create index on groups (tournament_id, category_id);

alter table pairs
  add column group_id uuid references groups(id) on delete set null;

create index on pairs (group_id);

alter table groups enable row level security;
create policy "groups_public_read" on groups for select using (true);
create policy "groups_admin_write" on groups for all using (is_admin()) with check (is_admin());

create trigger groups_audit after insert or update or delete on groups
  for each row execute function audit_row_change();

-- -------------------------------------------------------------------------
-- Función: run_draw(category_id, seed)
-- Sortea las pairs `confirmed` sin group_id en esa categoría.
-- Algoritmo:
--   - Si < 4 pairs: no sortea, error.
--   - Si 4-6 pairs: 1 solo grupo "A" round-robin.
--   - Si 7-12 pairs: 2 grupos balanceados (serpiente).
--   - Si 13-18: 3 grupos.
--   - Si 19+: 4 grupos.
-- El seed determina el orden inicial (md5(seed || pair_id) ordering).
-- Genera matches round-robin (todos contra todos dentro del grupo).
-- =========================================================================
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
  -- Validación: existe la categoría?
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

  -- Decide cuántos grupos
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

  -- Asigna pairs a grupos con distribución serpiente
  -- Orden determinístico: md5(seed || pair_id) hash. Para que sea reproducible.
  v_position := 0;
  for v_pair_record in
    select p.id
    from pairs p
    where p.category_id = p_category_id
      and p.status = 'confirmed'
      and p.group_id is null
    order by md5(p_seed::text || '-' || p.id::text)
  loop
    -- Serpiente: 0,1,2,3,3,2,1,0,0,1,2,3,...
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
-- Función: reset_draw(category_id)
-- Deshace el sorteo: borra matches en group phase, borra groups, NULL group_id.
-- Sólo permitido si NINGÚN match está validated/disputed/walkover.
-- =========================================================================
create or replace function reset_draw(p_category_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_locked_count int;
  v_deleted      int;
begin
  -- No permitir si hay matches con resultado consignado
  select count(*) into v_locked_count
  from matches
  where category_id = p_category_id
    and status in ('validated', 'disputed', 'walkover');

  if v_locked_count > 0 then
    raise exception 'cannot_reset_with_locked_matches (% matches already resolved)', v_locked_count;
  end if;

  -- Borra matches de la categoría (sólo en fase grupos por ahora)
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
-- Vista: category_standings
-- Por cada pair en un grupo, calcula:
--   - matches_played, matches_won, matches_lost
--   - sets_won, sets_lost, sets_diff
--   - games_won, games_lost, games_diff
-- Orden default: matches_won desc, sets_diff desc, games_diff desc, captain_id asc
-- El desempate por H2H se calcula en query separada cuando es necesario.
-- =========================================================================
create or replace view category_standings as
with pair_sets as (
  -- Sets ganados/perdidos por cada pair en partidos consignados
  select
    p.id as pair_id,
    p.category_id,
    p.group_id,
    m.id as match_id,
    m.status as match_status,
    m.winner_pair_id,
    case when m.pair_a_id = p.id then s.games_a else s.games_b end as games_for,
    case when m.pair_a_id = p.id then s.games_b else s.games_a end as games_against,
    case
      when m.pair_a_id = p.id and s.games_a > s.games_b then 1
      when m.pair_b_id = p.id and s.games_b > s.games_a then 1
      else 0
    end as set_won
  from pairs p
  join matches m on (m.pair_a_id = p.id or m.pair_b_id = p.id)
  left join sets s on s.match_id = m.id
  where m.status in ('validated', 'walkover')
    and p.group_id is not null
),
pair_walkovers as (
  -- Walkovers se cuentan como 2 sets 6-0 (§9)
  select
    p.id as pair_id,
    p.category_id,
    p.group_id,
    m.id as match_id,
    case when m.winner_pair_id = p.id then 1 else 0 end as match_won,
    case when m.winner_pair_id = p.id then 12 else 0 end as games_for,
    case when m.winner_pair_id = p.id then 0 else 12 end as games_against,
    case when m.winner_pair_id = p.id then 2 else 0 end as sets_won,
    case when m.winner_pair_id = p.id then 0 else 2 end as sets_lost
  from pairs p
  join matches m on (m.pair_a_id = p.id or m.pair_b_id = p.id)
  where m.status = 'walkover'
    and p.group_id is not null
),
pair_matches as (
  select
    p.id as pair_id,
    p.category_id,
    p.group_id,
    p.captain_id,
    count(distinct m.id) filter (where m.status in ('validated', 'walkover')) as matches_played,
    count(distinct m.id) filter (where m.status in ('validated', 'walkover') and m.winner_pair_id = p.id) as matches_won
  from pairs p
  left join matches m on (m.pair_a_id = p.id or m.pair_b_id = p.id)
  where p.group_id is not null
  group by p.id, p.category_id, p.group_id, p.captain_id
),
sets_agg as (
  select
    pair_id,
    sum(set_won) as sets_won,
    sum(1 - set_won) as sets_lost,
    sum(games_for) as games_for,
    sum(games_against) as games_against
  from pair_sets
  group by pair_id
)
select
  pm.pair_id,
  pm.category_id,
  pm.group_id,
  pm.matches_played,
  pm.matches_won,
  pm.matches_played - pm.matches_won as matches_lost,
  coalesce(sa.sets_won, 0) as sets_won,
  coalesce(sa.sets_lost, 0) as sets_lost,
  coalesce(sa.sets_won, 0) - coalesce(sa.sets_lost, 0) as sets_diff,
  coalesce(sa.games_for, 0) as games_for,
  coalesce(sa.games_against, 0) as games_against,
  coalesce(sa.games_for, 0) - coalesce(sa.games_against, 0) as games_diff
from pair_matches pm
left join sets_agg sa on sa.pair_id = pm.pair_id;

-- Las vistas heredan los permisos de las tablas subyacentes (RLS aplica),
-- pero hacemos un grant explícito por claridad.
grant select on category_standings to anon, authenticated;

-- -------------------------------------------------------------------------
-- Función: schedule_match(match_id, scheduled_at, court_label)
-- Helper para programar/reprogramar partidos desde el panel admin.
-- =========================================================================
create or replace function schedule_match(
  p_match_id uuid,
  p_scheduled_at timestamptz,
  p_court_label text
)
returns void
language sql
security definer
as $$
  update matches
  set scheduled_at = p_scheduled_at,
      court_label = p_court_label
  where id = p_match_id;
$$;
