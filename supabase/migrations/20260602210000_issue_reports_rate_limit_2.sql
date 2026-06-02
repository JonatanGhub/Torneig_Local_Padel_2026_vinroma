-- =========================================================================
-- 20260602210000_issue_reports_rate_limit_2.sql
-- Baixem el límit anti-spam de 5 a 2 reports per usuari i 24h.
-- L'admin igualment rep avís de cadascun.
-- =========================================================================

set search_path = public;

create or replace function issue_reports_rate_limit()
returns trigger language plpgsql as $$
declare v_count int;
begin
  if new.reporter_user_id is null then return new; end if;
  select count(*) into v_count from issue_reports
    where reporter_user_id = new.reporter_user_id
      and created_at > now() - interval '24 hours';
  if v_count >= 2 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  return new;
end;
$$;
