-- =========================================================================
-- 20260602050000_sponsor_requests.sql
-- Peticions públiques de patrocini.
-- Qualsevol persona pot enviar una petició des de /sponsors/proposar; queden
-- en estat "pending" fins que un administrador les aprova o rebutja. En
-- aprovar-les, l'admin manualment crea l'entrada definitiva a `sponsors` (per
-- evitar que dades sense validar acabin públiques per error).
-- =========================================================================

set search_path = public;

create type sponsor_request_status as enum ('pending', 'approved', 'rejected');

create table sponsor_requests (
  id uuid primary key default gen_random_uuid(),
  -- Dades del patrocinador.
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  logo_url text not null check (length(logo_url) <= 2048),
  website_url text check (length(website_url) <= 2048),
  tier sponsor_tier not null default 'collaborator',
  role_ca text check (length(role_ca) <= 200),
  role_es text check (length(role_es) <= 200),
  -- Dades de contacte de qui envia la petició.
  submitter_name text not null check (length(trim(submitter_name)) > 0 and length(submitter_name) <= 120),
  submitter_email text not null check (length(submitter_email) <= 254 and submitter_email ~ '^[^@]+@[^@]+\.[^@]+$'),
  submitter_phone text check (length(submitter_phone) <= 40),
  message text check (length(message) <= 1000),
  -- Validació.
  status sponsor_request_status not null default 'pending',
  admin_notes text check (length(admin_notes) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index sponsor_requests_status_idx on sponsor_requests (status, created_at desc);

alter table sponsor_requests enable row level security;

-- Qualsevol pot enviar una petició (formulari públic).
create policy "sponsor_requests_insert_public"
  on sponsor_requests for insert with check (true);

-- Només admin pot llegir, actualitzar i esborrar peticions.
create policy "sponsor_requests_select_admin"
  on sponsor_requests for select using (is_admin());
create policy "sponsor_requests_update_admin"
  on sponsor_requests for update using (is_admin()) with check (is_admin());
create policy "sponsor_requests_delete_admin"
  on sponsor_requests for delete using (is_admin());

grant insert on sponsor_requests to anon, authenticated;
grant select, update, delete on sponsor_requests to authenticated;
