-- =========================================================================
-- 20260801170000_standings_group_phase_only.sql
-- BUG: category_standings no filtrava per fase — qualsevol resultat de
-- l'ELIMINATÒRIA (validated o walkover, com el W.O. de la consolació de
-- 1a) es sumava a la classificació de la fase de grups: canviava punts,
-- sets i jocs, i feia que la previsió de quadre de la portada (que es
-- calcula a partir d'aquesta vista) mostrés encreuaments diferents dels
-- del quadre real. La classificació de grups NOMÉS ha de comptar partits
-- amb phase = 'group'.
-- =========================================================================

set search_path = public;

create or replace view category_standings as
 WITH pair_sets AS (
         SELECT p.id AS pair_id,
            p.category_id,
            p.group_id,
            m.id AS match_id,
                CASE
                    WHEN m.pair_a_id = p.id THEN s.games_a
                    ELSE s.games_b
                END AS games_for,
                CASE
                    WHEN m.pair_a_id = p.id THEN s.games_b
                    ELSE s.games_a
                END AS games_against,
                CASE
                    WHEN m.pair_a_id = p.id AND s.games_a > s.games_b THEN 1
                    WHEN m.pair_b_id = p.id AND s.games_b > s.games_a THEN 1
                    ELSE 0
                END AS set_won
           FROM pairs p
             JOIN matches m ON (m.pair_a_id = p.id OR m.pair_b_id = p.id) AND m.phase = 'group'
             LEFT JOIN sets s ON s.match_id = m.id
          WHERE m.status = 'validated'::match_status AND p.group_id IS NOT NULL
        ), pair_walkovers AS (
         SELECT p.id AS pair_id,
            p.category_id,
            p.group_id,
            m.id AS match_id,
                CASE
                    WHEN m.winner_pair_id = p.id THEN 12
                    ELSE 0
                END AS games_for,
                CASE
                    WHEN m.winner_pair_id = p.id THEN 0
                    ELSE 12
                END AS games_against,
                CASE
                    WHEN m.winner_pair_id = p.id THEN 2
                    ELSE 0
                END AS sets_won,
                CASE
                    WHEN m.winner_pair_id = p.id THEN 0
                    ELSE 2
                END AS sets_lost
           FROM pairs p
             JOIN matches m ON (m.pair_a_id = p.id OR m.pair_b_id = p.id) AND m.phase = 'group'
          WHERE m.status = 'walkover'::match_status AND p.group_id IS NOT NULL
        ), pair_matches AS (
         SELECT p.id AS pair_id,
            p.category_id,
            p.group_id,
            p.captain_id,
            count(DISTINCT m.id) FILTER (WHERE m.status = ANY (ARRAY['validated'::match_status, 'walkover'::match_status])) AS matches_played,
            count(DISTINCT m.id) FILTER (WHERE (m.status = ANY (ARRAY['validated'::match_status, 'walkover'::match_status])) AND m.winner_pair_id = p.id) AS matches_won
           FROM pairs p
             LEFT JOIN matches m ON (m.pair_a_id = p.id OR m.pair_b_id = p.id) AND m.phase = 'group'
          WHERE p.group_id IS NOT NULL
          GROUP BY p.id, p.category_id, p.group_id, p.captain_id
        ), sets_combined AS (
         SELECT pair_sets.pair_id,
            pair_sets.set_won AS sets_won_inc,
            1 - pair_sets.set_won AS sets_lost_inc,
            pair_sets.games_for,
            pair_sets.games_against
           FROM pair_sets
        UNION ALL
         SELECT pair_walkovers.pair_id,
            pair_walkovers.sets_won,
            pair_walkovers.sets_lost,
            pair_walkovers.games_for,
            pair_walkovers.games_against
           FROM pair_walkovers
        ), sets_agg AS (
         SELECT sets_combined.pair_id,
            sum(sets_combined.sets_won_inc) AS sets_won,
            sum(sets_combined.sets_lost_inc) AS sets_lost,
            sum(sets_combined.games_for) AS games_for,
            sum(sets_combined.games_against) AS games_against
           FROM sets_combined
          GROUP BY sets_combined.pair_id
        )
 SELECT pm.pair_id,
    pm.category_id,
    pm.group_id,
    pm.matches_played,
    pm.matches_won,
    pm.matches_played - pm.matches_won AS matches_lost,
    COALESCE(sa.sets_won, 0::bigint) AS sets_won,
    COALESCE(sa.sets_lost, 0::bigint) AS sets_lost,
    COALESCE(sa.sets_won, 0::bigint) - COALESCE(sa.sets_lost, 0::bigint) AS sets_diff,
    COALESCE(sa.games_for, 0::bigint) AS games_for,
    COALESCE(sa.games_against, 0::bigint) AS games_against,
    COALESCE(sa.games_for, 0::bigint) - COALESCE(sa.games_against, 0::bigint) AS games_diff
   FROM pair_matches pm
     LEFT JOIN sets_agg sa ON sa.pair_id = pm.pair_id;
