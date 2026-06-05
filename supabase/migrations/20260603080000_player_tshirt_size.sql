-- =========================================================================
-- 20260603080000_player_tshirt_size.sql
-- Afegeix la talla de samarreta de cada jugador. Es demana al formulari
-- d'inscripció i es mostra al panell d'administració.
--
-- Es modela com a enum perquè les talles són tancades i així evitem
-- typos. Si en algun moment cal afegir-ne més (3XL, infant…), és un ALTER
-- TYPE ADD VALUE de PostgreSQL.
-- =========================================================================

set search_path = public;

create type tshirt_size as enum ('XS', 'S', 'M', 'L', 'XL', 'XXL');

alter table players add column tshirt_size tshirt_size;

-- No es força NOT NULL per als jugadors ja inscrits, només per als nous.
-- Les inscripcions noves la requereixen via la validació zod a l'app.
