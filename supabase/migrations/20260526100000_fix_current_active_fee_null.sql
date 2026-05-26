-- -------------------------------------------------------------------------
-- Fix: current_active_fee() retornava una fila amb tots els camps NULL
-- quan cap tram cobria la data sol·licitada (comportament estàndard d'una
-- funció SQL `returns <composite>`). El codi TS interpretava aquesta fila
-- com a "tram trobat amb is_default_open=null" i mostrava el missatge
-- "només a discreció de l'organització" enlloc de "inscripcions tancades".
--
-- Solució: canviem a `returns setof tournament_fees`. Si no hi ha match,
-- el resultset és buit i el client rep array buit (o NULL via .single()).
-- -------------------------------------------------------------------------

drop function if exists current_active_fee(uuid, timestamptz);

create or replace function current_active_fee(
  p_tournament_id uuid,
  p_at timestamptz default now()
)
returns setof tournament_fees
language sql
stable
as $$
  select *
  from tournament_fees
  where tournament_id = p_tournament_id
    and p_at >= starts_at
    and p_at <= ends_at
  order by is_default_open desc, starts_at asc
  limit 1;
$$;
