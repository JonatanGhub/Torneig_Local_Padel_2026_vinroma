-- =========================================================================
-- 20260602080000_issue_reports.sql
-- Reports d'incidències enviats pels capitans des del seu panell.
--
-- Filosofia:
-- - El capità els crea (RLS: insert obert a usuaris autenticats; ja és prou).
-- - L'admin els llegeix i els classifica. Cap capità no veu els d'altres.
-- - Es captura context tècnic (URL on va passar, user agent) per facilitar
--   la diagnosi sense haver de demanar-ho al capità.
-- =========================================================================

set search_path = public;

create type issue_report_severity as enum ('low', 'medium', 'high', 'critical');
create type issue_report_status as enum (
  'new',        -- recent, no triat
  'triaged',    -- vist per admin, pendent de resolució
  'accepted',   -- és un fallo real; hi ha PR obert
  'rejected',   -- no és un fallo, descartat amb motiu
  'fixed'       -- ja resolt
);

create table issue_reports (
  id uuid primary key default gen_random_uuid(),
  -- Qui l'envia. Es desa l'auth_user_id directament i un snapshot del
  -- correu/nom perquè, encara que es regeneri el player de la temporada
  -- següent, el report no perdi la traçabilitat.
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_email text not null check (length(reporter_email) <= 254),
  reporter_name text check (length(reporter_name) <= 200),
  -- Contingut.
  title text not null check (length(trim(title)) > 0 and length(title) <= 200),
  description text not null check (length(trim(description)) > 0 and length(description) <= 4000),
  severity issue_report_severity not null default 'medium',
  -- Context tècnic.
  page_url text check (length(page_url) <= 2048),
  user_agent text check (length(user_agent) <= 500),
  locale text check (locale in ('ca','es')),
  -- Gestió.
  status issue_report_status not null default 'new',
  admin_notes text check (length(admin_notes) <= 4000),
  pr_url text check (length(pr_url) <= 2048),
  triaged_at timestamptz,
  triaged_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index issue_reports_status_idx on issue_reports (status, created_at desc);
create index issue_reports_reporter_recent_idx
  on issue_reports (reporter_user_id, created_at desc);

alter table issue_reports enable row level security;

-- Inserció: qualsevol usuari autenticat (els capitans entren amb
-- magic-link/PIN, així que tenen auth.uid()). Es força reporter_user_id =
-- auth.uid() per evitar suplantar.
create policy "issues_insert_authenticated"
  on issue_reports for insert
  with check (
    auth.uid() is not null and reporter_user_id = auth.uid()
  );

-- Lectura: només admin. El capità no veu els reports d'altres.
create policy "issues_select_admin"
  on issue_reports for select using (is_admin());

-- Update / delete: només admin.
create policy "issues_update_admin"
  on issue_reports for update using (is_admin()) with check (is_admin());
create policy "issues_delete_admin"
  on issue_reports for delete using (is_admin());

grant insert on issue_reports to authenticated;
grant select, update, delete on issue_reports to authenticated;

create or replace function issue_reports_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger issue_reports_set_updated
  before update on issue_reports
  for each row execute function issue_reports_touch_updated();

-- Anti-spam suau: límit de 2 reports per usuari en 24h. La interacció normal
-- d'un capità no s'hi acosta. L'admin igualment rep avís de cadascun.
create or replace function issue_reports_rate_limit()
returns trigger language plpgsql as $$
declare
  v_count int;
begin
  if new.reporter_user_id is null then
    return new;
  end if;
  select count(*) into v_count
  from issue_reports
  where reporter_user_id = new.reporter_user_id
    and created_at > now() - interval '24 hours';
  if v_count >= 2 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger issue_reports_check_rate
  before insert on issue_reports
  for each row execute function issue_reports_rate_limit();
