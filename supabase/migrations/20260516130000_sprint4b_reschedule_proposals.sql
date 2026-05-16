-- =========================================================================
-- 20260516130000_sprint4b_reschedule_proposals.sql
-- Sprint 4b — Modificación de calendario por acuerdo entre capitanes
-- =========================================================================

set search_path = public;

create type reschedule_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

create table match_reschedule_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  proposer_player_id uuid not null references players(id),
  proposer_pair_side text not null check (proposer_pair_side in ('a','b')),
  new_scheduled_at timestamptz not null,
  new_court_label text,
  message text,
  status reschedule_status not null default 'pending',
  responded_by_player_id uuid references players(id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index match_reschedule_one_pending
  on match_reschedule_proposals (match_id)
  where status = 'pending';

create index match_reschedule_proposer_idx
  on match_reschedule_proposals (proposer_player_id);

alter table match_reschedule_proposals enable row level security;

create policy "reschedule_select_captain_or_admin"
  on match_reschedule_proposals for select
  using (
    is_admin()
    or exists (
      select 1
      from matches m
      join pairs pa on pa.id in (m.pair_a_id, m.pair_b_id)
      where m.id = match_id
        and pa.captain_id = (select id from players where auth_user_id = auth.uid())
    )
  );

revoke insert, update, delete on match_reschedule_proposals from anon, authenticated;

create or replace function propose_reschedule(
  p_match_id uuid,
  p_new_scheduled_at timestamptz,
  p_new_court_label text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_match record;
  v_side text;
  v_proposal_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select id into v_player_id from players where auth_user_id = v_user_id;
  if v_player_id is null then raise exception 'no_player_profile'; end if;

  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status in ('validated','walkover') then raise exception 'match_already_finished'; end if;

  if exists (select 1 from pairs where id = v_match.pair_a_id and captain_id = v_player_id) then v_side := 'a';
  elsif exists (select 1 from pairs where id = v_match.pair_b_id and captain_id = v_player_id) then v_side := 'b';
  else raise exception 'not_captain_of_this_match';
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
end;
$$;

grant execute on function propose_reschedule(uuid, timestamptz, text, text) to authenticated;

create or replace function respond_to_reschedule(
  p_proposal_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_proposal record;
  v_match record;
  v_is_admin boolean;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_is_admin := is_admin();
  select id into v_player_id from players where auth_user_id = v_user_id;
  if v_player_id is null and not v_is_admin then raise exception 'no_player_profile'; end if;

  select * into v_proposal from match_reschedule_proposals where id = p_proposal_id;
  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.status <> 'pending' then raise exception 'proposal_not_pending'; end if;

  select * into v_match from matches where id = v_proposal.match_id;

  if not v_is_admin then
    if v_proposal.proposer_pair_side = 'a' then
      if not exists (select 1 from pairs where id = v_match.pair_b_id and captain_id = v_player_id) then
        raise exception 'not_rival_captain';
      end if;
    else
      if not exists (select 1 from pairs where id = v_match.pair_a_id and captain_id = v_player_id) then
        raise exception 'not_rival_captain';
      end if;
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
end;
$$;

grant execute on function respond_to_reschedule(uuid, boolean) to authenticated;

create or replace function cancel_reschedule(p_proposal_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_proposal record;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select id into v_player_id from players where auth_user_id = v_user_id;
  if v_player_id is null then raise exception 'no_player_profile'; end if;

  select * into v_proposal from match_reschedule_proposals where id = p_proposal_id;
  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.status <> 'pending' then raise exception 'proposal_not_pending'; end if;
  if v_proposal.proposer_player_id <> v_player_id and not is_admin() then
    raise exception 'only_proposer_can_cancel';
  end if;

  update match_reschedule_proposals
    set status = 'cancelled', responded_by_player_id = v_player_id, responded_at = now()
    where id = p_proposal_id;
  return 'cancelled';
end;
$$;

grant execute on function cancel_reschedule(uuid) to authenticated;
