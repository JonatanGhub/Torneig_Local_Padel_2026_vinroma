-- =========================================================================
-- 20260524193100_role_assignment_by_email.sql
-- Asignación de rol por email en el alta de usuarios (auth.users).
-- =========================================================================
-- Regla:
--   - clubpadelvinroma@gmail.com  -> role = 'admin'
--   - cualquier otro email        -> role = 'captain'
-- El rol se escribe en raw_app_meta_data.role (lo lee is_admin()).
-- Incluye backfill idempotente de los usuarios ya existentes.
-- =========================================================================

set search_path = public;

create or replace function public.assign_role_on_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'role',
         case when lower(new.email) = 'clubpadelvinroma@gmail.com' then 'admin' else 'captain' end
       );
  return new;
exception
  when others then
    return new; -- never block an auth signup
end;
$$;

drop trigger if exists assign_role_on_signup on auth.users;
create trigger assign_role_on_signup
  before insert on auth.users
  for each row execute function public.assign_role_on_signup();

-- Backfill: solo la dirección del club es admin; el resto, captain.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'role',
       case when lower(email) = 'clubpadelvinroma@gmail.com' then 'admin' else 'captain' end
     );
