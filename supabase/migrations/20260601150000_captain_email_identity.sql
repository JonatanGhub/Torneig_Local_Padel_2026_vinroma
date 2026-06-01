-- =========================================================================
-- 20260601150000_captain_email_identity.sql
-- Identitat del capità per CORREU, no només per auth_user_id.
--
-- Una persona pot tenir múltiples files a `players` (una per inscripció) i
-- només una queda enllaçada a `auth_user_id`. Totes les comprovacions de
-- "capità" han de considerar TOTES les files amb el mateix correu que
-- l'usuari autenticat. Si no, un capità amb parelles en diverses categories
-- només pot operar amb una i queda bloquejat a la resta (veure/reportar/
-- reprogramar/retirar).
-- =========================================================================

set search_path = public;

-- Tots els player ids de l'usuari autenticat (per auth_user_id o per correu).
create or replace function public.current_player_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from players p
  where p.auth_user_id = auth.uid()
     or (
       coalesce(auth.jwt() ->> 'email', '') <> ''
       and lower(p.email) = lower(auth.jwt() ->> 'email')
     );
$$;

-- Un sol player id "canònic" per inserir reports/propostes: preferim el
-- vinculat a auth_user_id; si no n'hi ha cap, el més antic amb aquest correu.
create or replace function public.current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select id from players where auth_user_id = auth.uid() limit 1),
    (select id from players
       where coalesce(auth.jwt() ->> 'email', '') <> ''
         and lower(email) = lower(auth.jwt() ->> 'email')
       order by created_at asc
       limit 1)
  );
$$;

-- Redefinim is_captain_of perquè usi el conjunt de player ids per correu.
-- Aquesta funció alimenta les RLS de pairs/match_reports i el botó de retirada.
create or replace function public.is_captain_of(p_pair_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pairs p
    where p.id = p_pair_id
      and p.captain_id in (select current_player_ids())
  );
$$;

-- RPC: reportar resultat ------------------------------------------------------
create or replace function public.submit_match_report(p_match_id uuid, p_score jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_player_id uuid; v_match record; v_side text; v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  v_is_admin := is_admin();
  v_player_id := current_player_id();
  if v_player_id is null and not v_is_admin then raise exception 'no_player_profile'; end if;
  select m.* into v_match from matches m where m.id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;

  if v_is_admin then
    v_side := 'admin';
    if v_player_id is null then raise exception 'admin_without_player_profile'; end if;
  else
    if is_captain_of(v_match.pair_a_id) then
      v_side := 'a';
    elsif is_captain_of(v_match.pair_b_id) then
      v_side := 'b';
    else
      raise exception 'not_captain_of_this_match';
    end if;
  end if;

  insert into match_reports (match_id, reporter_player_id, reporter_pair_side, score_json)
  values (p_match_id, v_player_id, v_side, p_score)
  on conflict (match_id, reporter_player_id)
  do update set score_json = excluded.score_json,
                reporter_pair_side = excluded.reporter_pair_side,
                reported_at = now();

  return v_side;
end; $function$;

-- RPC: proposar reprogramació -------------------------------------------------
create or replace function public.propose_reschedule(
  p_match_id uuid,
  p_new_scheduled_at timestamptz,
  p_new_court_label text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_player_id uuid; v_match record; v_side text; v_proposal_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  v_player_id := current_player_id();
  if v_player_id is null then raise exception 'no_player_profile'; end if;
  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status in ('validated','walkover') then raise exception 'match_already_finished'; end if;

  if is_captain_of(v_match.pair_a_id) then
    v_side := 'a';
  elsif is_captain_of(v_match.pair_b_id) then
    v_side := 'b';
  else
    raise exception 'not_captain_of_this_match';
  end if;

  if p_new_scheduled_at <= now() then raise exception 'new_date_must_be_future'; end if;

  update match_reschedule_proposals
    set status = 'cancelled', responded_by_player_id = v_player_id, responded_at = now()
    where match_id = p_match_id and status = 'pending';

  insert into match_reschedule_proposals (
    match_id, proposer_player_id, proposer_pair_side,
    new_scheduled_at, new_court_label, message
  )
  values (
    p_match_id, v_player_id, v_side,
    p_new_scheduled_at, p_new_court_label, p_message
  )
  returning id into v_proposal_id;

  return v_proposal_id;
end; $function$;

-- RPC: respondre a una proposta de reprogramació ------------------------------
create or replace function public.respond_to_reschedule(p_proposal_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_player_id uuid; v_proposal record; v_match record; v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  v_is_admin := is_admin();
  v_player_id := current_player_id();
  if v_player_id is null and not v_is_admin then raise exception 'no_player_profile'; end if;

  select * into v_proposal from match_reschedule_proposals where id = p_proposal_id;
  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.status <> 'pending' then raise exception 'proposal_not_pending'; end if;

  select * into v_match from matches where id = v_proposal.match_id;

  if not v_is_admin then
    if v_proposal.proposer_pair_side = 'a' then
      if not is_captain_of(v_match.pair_b_id) then raise exception 'not_rival_captain'; end if;
    else
      if not is_captain_of(v_match.pair_a_id) then raise exception 'not_rival_captain'; end if;
    end if;
  end if;

  if p_accept then
    update match_reschedule_proposals
      set status = 'accepted', responded_by_player_id = v_player_id, responded_at = now()
      where id = p_proposal_id;
    update matches
      set scheduled_at = v_proposal.new_scheduled_at,
          court_label = coalesce(v_proposal.new_court_label, court_label)
      where id = v_proposal.match_id;
    return 'accepted';
  else
    update match_reschedule_proposals
      set status = 'rejected', responded_by_player_id = v_player_id, responded_at = now()
      where id = p_proposal_id;
    return 'rejected';
  end if;
end; $function$;

-- RLS: lectura de propostes de reprogramació pel capità (qualsevol de les
-- seves parelles, via is_captain_of corregit) o admin.
drop policy if exists reschedule_select_captain_or_admin on match_reschedule_proposals;
create policy reschedule_select_captain_or_admin
  on match_reschedule_proposals
  for select
  using (
    is_admin() or exists (
      select 1 from matches m
      where m.id = match_reschedule_proposals.match_id
        and (is_captain_of(m.pair_a_id) or is_captain_of(m.pair_b_id))
    )
  );
