-- =========================================================================
-- 20260626190000_public_player_names_add_first_name.sql
-- Afegeix `first_name` a la projecció pública `public_player_names`.
-- =========================================================================
-- La pàgina inicial mostra les parelles inscrites i ara ha d'ensenyar el nom
-- complet (nom + cognoms), no només el cognom. La vista segueix exposant només
-- nom i cognoms (mai email, telèfon, data de naixement, tutor ni contacte
-- d'emergència) i només per a jugadors de torneigs publicats i no anonimitzats.
--
-- `create or replace view` permet afegir columnes al final mantenint l'ordre
-- existent (id, last_name) i conserva els GRANT a anon/authenticated.
-- =========================================================================

set search_path = public;

create or replace view public_player_names
with (security_invoker = false) as
select pl.id, pl.last_name, pl.first_name
from players pl
where pl.is_anonymized = false
  and exists (
    select 1
    from pairs p
    join tournaments t on t.id = p.tournament_id
    where (pl.id = p.player_a_id or pl.id = p.player_b_id)
      and t.is_published = true
  );
