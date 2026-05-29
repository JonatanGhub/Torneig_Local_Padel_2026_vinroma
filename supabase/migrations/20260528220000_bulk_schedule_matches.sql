-- =========================================================================
-- 20260528220000_bulk_schedule_matches.sql
-- RPC per programar molts partits d'un cop (assignació automàtica d'horaris).
-- Rep un array JSON [{match_id, scheduled_at, court_label}, ...].
-- Guardat admin (is_admin), igual que schedule_match.
-- =========================================================================

set search_path = public;

create or replace function bulk_schedule_matches(p_assignments jsonb)
returns integer
language plpgsql
security definer
as $$
declare
  v_count int := 0;
  v_row   jsonb;
begin
  if not is_admin() then
    raise exception 'only_admin';
  end if;

  for v_row in select * from jsonb_array_elements(p_assignments)
  loop
    update matches
       set scheduled_at = (v_row->>'scheduled_at')::timestamptz,
           court_label  = v_row->>'court_label'
     where id = (v_row->>'match_id')::uuid;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function bulk_schedule_matches(jsonb) from anon, public;
grant execute on function bulk_schedule_matches(jsonb) to authenticated;
