-- =========================================================================
-- 20260526200000_link_player_to_auth_user.sql
--
-- Auto-vinculació entre auth.users i players per correu.
--
-- Quan algú s'inscriu al torneig, es crea un row a `players` amb `email`
-- però sense `auth_user_id`. Més tard, quan aquesta mateixa persona inicia
-- sessió per magic-link, Supabase crea un row a `auth.users` amb el mateix
-- correu. Aquest trigger fa el match per `lower(email)` i deixa enllaçat
-- el player amb l'auth_user_id corresponent.
--
-- Inclou backfill idempotent dels usuaris i jugadors ja existents.
-- =========================================================================

set search_path = public;

create or replace function public.link_player_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
begin
  if v_email = '' then
    return new;
  end if;

  update public.players
     set auth_user_id = new.id
   where auth_user_id is null
     and lower(email) = v_email;

  return new;
exception
  when others then
    -- mai bloquejar el signup/login per un error d'aquest lligam
    return new;
end;
$$;

-- Es dispara tant en INSERT com en UPDATE (per cobrir el cas en què el row
-- ja existeix sense email_confirmed_at i s'actualitza al confirmar).
drop trigger if exists link_player_to_auth_user_ins on auth.users;
create trigger link_player_to_auth_user_ins
  after insert on auth.users
  for each row execute function public.link_player_to_auth_user();

drop trigger if exists link_player_to_auth_user_upd on auth.users;
create trigger link_player_to_auth_user_upd
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.link_player_to_auth_user();

-- Backfill: vincula tots els jugadors actuals amb usuaris ja existents.
update public.players p
   set auth_user_id = u.id
  from auth.users u
 where p.auth_user_id is null
   and lower(p.email) = lower(u.email);
