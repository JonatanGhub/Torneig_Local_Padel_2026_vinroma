-- =========================================================================
-- 20260524200000_public_player_names_view.sql
-- Proyección pública de los APELLIDOS de jugadores en torneos publicados.
-- =========================================================================
-- La tabla players queda bloqueada por RLS (solo el propio jugador o admin).
-- Para que las páginas públicas (/grups, /quadre, /calendari) puedan mostrar
-- los nombres de las parejas a visitantes anónimos, esta vista expone ÚNICAMENTE
-- id + last_name (nunca email, teléfono, fecha de nacimiento, tutor legal ni
-- contacto de emergencia), y solo para jugadores de torneos publicados y no
-- anonimizados.
--
-- Es una vista "security definer" (security_invoker = false) a propósito: se
-- ejecuta con los permisos del propietario para puentear el RLS de players,
-- exponiendo solo la columna segura. No usar RLS a nivel de fila aquí porque
-- expondría todas las columnas de players.
-- =========================================================================

set search_path = public;

create or replace view public_player_names
with (security_invoker = false) as
select pl.id, pl.last_name
from players pl
where pl.is_anonymized = false
  and exists (
    select 1
    from pairs p
    join tournaments t on t.id = p.tournament_id
    where (pl.id = p.player_a_id or pl.id = p.player_b_id)
      and t.is_published = true
  );

grant select on public_player_names to anon, authenticated;
