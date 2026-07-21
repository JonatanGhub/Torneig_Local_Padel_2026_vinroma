-- =========================================================================
-- 20260716120000_knockout_phase_guards.sql
-- Guardes de consistència per a la fase eliminatòria. El trigger
-- advance_knockout crea la ronda següent quan es tanquen tots els partits
-- d'una ronda; a partir d'aquell moment, canviar el guanyador d'un partit
-- de la ronda anterior (o anul·lar-lo) deixaria el quadre incoherent — la
-- parella "avançada" seguiria a la ronda següent encara que ja no fos la
-- guanyadora. Bloquegem aquestes dues operacions amb un error explícit
-- perquè l'admin sàpiga que primer ha de desfer la ronda següent a mà.
-- =========================================================================

set search_path = public;

-- Helper: true si ja existeix la ronda següent del mateix quadre (ko/cons)
-- d'aquest partit. Per a fases no eliminatòries retorna false.
create or replace function knockout_next_round_exists(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_match record;
  v_bracket text;
  v_round int;
begin
  select category_id, phase into v_match from matches where id = p_match_id;
  if not found or v_match.phase !~ '^(ko|cons)_[0-9]+$' then return false; end if;
  v_bracket := split_part(v_match.phase, '_', 1);
  v_round := split_part(v_match.phase, '_', 2)::int;
  return exists (
    select 1 from matches
    where category_id = v_match.category_id
      and phase = v_bracket || '_' || (v_round + 1)
  );
end;
$$;

-- -------------------------------------------------------------------------
-- admin_annul_match_result: bloqueja anul·lar un partit eliminatori si la
-- ronda següent ja s'ha creat (el seu guanyador ja hi és).
-- -------------------------------------------------------------------------
create or replace function admin_annul_match_result(
  p_match_id uuid,
  p_new_scheduled_at timestamptz default null,
  p_new_court_label text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_match record;
begin
  if not is_admin() then raise exception 'only_admin'; end if;

  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status = 'scheduled' then raise exception 'match_not_played'; end if;
  if p_new_scheduled_at is not null and p_new_scheduled_at <= now() then
    raise exception 'new_date_must_be_future';
  end if;
  if knockout_next_round_exists(p_match_id) then
    raise exception 'next_round_already_created';
  end if;

  delete from match_reports where match_id = p_match_id;
  delete from sets where match_id = p_match_id;

  update match_reschedule_proposals
    set status = 'cancelled', responded_at = now()
    where match_id = p_match_id and status = 'pending';

  update matches
    set status = 'scheduled',
        winner_pair_id = null,
        reminder_sent_at = null,
        scheduled_at = p_new_scheduled_at,
        court_label = case when p_new_scheduled_at is not null then p_new_court_label else null end
    where id = p_match_id;

  insert into audit_log (table_name, row_pk, operation, new_data, actor_id)
  values (
    'matches', p_match_id::text, 'UPDATE',
    jsonb_build_object(
      'action', 'admin_annul_match_result',
      'previous_status', v_match.status,
      'new_scheduled_at', p_new_scheduled_at,
      'new_court_label', p_new_court_label,
      'reason', p_reason
    ),
    auth.uid()
  );
end;
$$;

-- -------------------------------------------------------------------------
-- admin_override_score: permet corregir el marcador d'un partit eliminatori
-- amb la ronda següent ja creada NOMÉS si el guanyador no canvia (correcció
-- de transcripció). Si el nou marcador capgira el guanyador, es bloqueja.
-- -------------------------------------------------------------------------
create or replace function admin_override_score(
  p_match_id uuid,
  p_score jsonb,
  p_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_match record;
  v_winner uuid;
begin
  if not is_admin() then raise exception 'only_admin'; end if;
  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;

  v_winner := score_winner(p_score, v_match.pair_a_id, v_match.pair_b_id);
  if v_winner is null then raise exception 'invalid_score'; end if;

  if v_winner is distinct from v_match.winner_pair_id
     and knockout_next_round_exists(p_match_id) then
    raise exception 'winner_locked_next_round_exists';
  end if;

  delete from match_reports where match_id = p_match_id;
  perform insert_sets_from_score(p_match_id, p_score);

  update matches
    set status = 'validated', winner_pair_id = v_winner
    where id = p_match_id;

  update match_reschedule_proposals
    set status = 'cancelled', responded_at = now()
    where match_id = p_match_id and status = 'pending';

  insert into audit_log (table_name, row_pk, operation, new_data, actor_id)
  values (
    'matches', p_match_id::text, 'UPDATE',
    jsonb_build_object(
      'status', 'validated',
      'winner_pair_id', v_winner,
      'admin_override_score', p_score,
      'admin_override_reason', p_reason
    ),
    auth.uid()
  );
end;
$$;

revoke execute on function knockout_next_round_exists(uuid) from anon, public;
