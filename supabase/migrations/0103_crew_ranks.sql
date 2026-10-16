-- Crew ranks, join rules and join requests (src/lib/clans.ts, src/ui/Social.tsx CrewMembers).
--   * Ranks: leader (one per crew), co_leader, member.
--       - Leader: everything. Promote / demote, hand over the lead, remove anyone, settings, requests.
--       - Co-Leader: settings, requests, remove Members. Never acts on the Leader or another Co-Leader.
--       - Member: nothing extra.
--   * Join rules on clans.join_mode: 'open' (anyone who meets the level joins), 'request' (asks,
--     a Leader or Co-Leader accepts), 'closed' (nobody new).
--   * The Leader leaving or their account going: the oldest Co-Leader takes over, else the oldest
--     Member; the last one out closes the crew. A trigger on clan_members does this, so it also
--     covers deleted accounts (the old leader_id cascade used to delete the whole crew).
--   * Co-Leaders can delete messages in their crew chat, like the Leader.
--   * Live client keeps working: join_clan, leave_clan, kick_clan_member and update_clan keep their
--     arguments (update_clan gains p_join_mode with a default). join_clan refuses request / closed
--     crews with a clear message.
-- Run BEFORE the game update that adds ranks. No econ_catalog / econ_guard change.

-- 1. Columns, rank values, requests table ---------------------------------------------------------
alter table public.clans add column if not exists join_mode text not null default 'open';
alter table public.clans drop constraint if exists clans_join_mode_check;
alter table public.clans add constraint clans_join_mode_check check (join_mode in ('open', 'request', 'closed'));

alter table public.clan_members drop constraint if exists clan_members_role_check;
alter table public.clan_members add constraint clan_members_role_check check (role in ('leader', 'co_leader', 'member'));
create unique index if not exists clan_members_one_leader on public.clan_members (clan_id) where role = 'leader';

-- Leadership is kept by the trigger below, not by a cascade that would delete the crew.
alter table public.clans drop constraint if exists clans_leader_id_fkey;

create table if not exists public.crew_join_requests (
  clan_id uuid not null references public.clans on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clan_id, owner_id)
);
create index if not exists crew_join_requests_owner_idx on public.crew_join_requests (owner_id);
alter table public.crew_join_requests enable row level security;
revoke all on public.crew_join_requests from anon, authenticated;
-- No policies: read and written only through the functions below.

-- Crew list and boards show the join rule.
create or replace view public.clan_leaderboard with (security_invoker = true) as
select
  c.id, c.name, c.tag, c.emblem, c.color, c.description, c.leader_id, c.member_cap, c.min_level, c.created_at,
  count(m.owner_id)::int as members,
  coalesce(sum(p.power), 0)::int as power,
  coalesce(sum(p.race_wins), 0)::int as race_wins,
  coalesce(sum(p.trophies), 0)::int as trophies,
  coalesce(sum(p.level), 0)::int as levels,
  coalesce(sum(p.week_power), 0)::int as week_power,
  coalesce(sum(p.week_race_wins), 0)::int as week_race_wins,
  coalesce(sum(p.week_trophies), 0)::int as week_trophies,
  coalesce(sum(p.week_levels), 0)::int as week_levels,
  c.join_mode
from public.clans c
left join public.clan_members m on m.clan_id = c.id
left join public.player_leaderboard p on p.owner_id = m.owner_id
group by c.id;

-- 2. Succession ----------------------------------------------------------------------------------
-- When the Leader's row goes (leaving, deleted account), the oldest Co-Leader, else the oldest
-- Member, takes over; nobody left closes the crew.
create or replace function public.crew_member_gone() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  heir uuid;
begin
  if old.role <> 'leader' then return null; end if;
  -- The crew itself is being deleted (cascade): nothing to hand over.
  perform 1 from public.clans where id = old.clan_id for update;
  if not found then return null; end if;
  if exists (select 1 from public.clan_members where clan_id = old.clan_id and role = 'leader') then return null; end if;
  select owner_id into heir from public.clan_members where clan_id = old.clan_id
    order by (role = 'co_leader') desc, joined_at, owner_id limit 1;
  if heir is null then
    delete from public.clans where id = old.clan_id;
  else
    update public.clan_members set role = 'leader' where owner_id = heir;
    update public.clans set leader_id = heir where id = old.clan_id;
  end if;
  return null;
end $$;
revoke all on function public.crew_member_gone() from public, anon, authenticated;

drop trigger if exists clan_members_gone on public.clan_members;
create trigger clan_members_gone after delete on public.clan_members
  for each row execute function public.crew_member_gone();

-- Joining a crew clears that player's other requests.
create or replace function public.crew_member_joined() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.crew_join_requests where owner_id = new.owner_id;
  return null;
end $$;
revoke all on function public.crew_member_joined() from public, anon, authenticated;

drop trigger if exists clan_members_joined on public.clan_members;
create trigger clan_members_joined after insert on public.clan_members
  for each row execute function public.crew_member_joined();

-- Crews whose leader account is already gone (before this file) get a leader now.
update public.clan_members m set role = 'leader'
from (
  select distinct on (cm.clan_id) cm.clan_id, cm.owner_id from public.clan_members cm
  where not exists (select 1 from public.clan_members l where l.clan_id = cm.clan_id and l.role = 'leader')
  order by cm.clan_id, cm.joined_at, cm.owner_id
) h where m.owner_id = h.owner_id;
update public.clans c set leader_id = m.owner_id from public.clan_members m
where m.clan_id = c.id and m.role = 'leader' and c.leader_id is distinct from m.owner_id;

-- 3. Helpers -------------------------------------------------------------------------------------
-- The signed-in player's crew row (null when not in one).
create or replace function public.crew_me() returns public.clan_members
language sql stable security definer set search_path = '' as $$
  select * from public.clan_members where owner_id = auth.uid()
$$;
revoke all on function public.crew_me() from public, anon, authenticated;

create or replace function public.crew_is_officer(p_role text) returns boolean
language sql immutable set search_path = '' as $$ select p_role in ('leader', 'co_leader') $$;
revoke all on function public.crew_is_officer(text) from public, anon, authenticated;

-- 4. Joining -------------------------------------------------------------------------------------
-- Old client's Join button: open crews only.
create or replace function public.join_clan(p_clan uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.clans;
  lvl int;
begin
  if me is null then raise exception 'Sign in to join a clan'; end if;
  if exists (select 1 from public.clan_members where owner_id = me) then raise exception 'Leave your current clan first'; end if;
  select * into c from public.clans where id = p_clan for update;
  if not found then raise exception 'That clan no longer exists'; end if;
  if c.join_mode = 'closed' then raise exception 'That clan is closed'; end if;
  if c.join_mode = 'request' then raise exception 'That clan takes join requests. Update the game to ask.'; end if;
  if (select count(*) from public.clan_members where clan_id = p_clan) >= c.member_cap then raise exception 'That clan is full'; end if;
  select level into lvl from public.game_saves where owner_id = me;
  if coalesce(lvl, 1) < c.min_level then raise exception 'You need level % to join', c.min_level; end if;
  insert into public.clan_members (owner_id, clan_id) values (me, p_clan);
end $$;

-- Join an open crew, or ask a request crew. Returns 'joined' or 'requested'.
create or replace function public.crew_ask_join(p_clan uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.clans;
  lvl int;
begin
  if me is null then raise exception 'Sign in to join a crew'; end if;
  if exists (select 1 from public.clan_members where owner_id = me) then raise exception 'Leave your current crew first'; end if;
  select * into c from public.clans where id = p_clan for update;
  if not found then raise exception 'That crew no longer exists'; end if;
  if c.join_mode = 'closed' then raise exception 'That crew is closed'; end if;
  if (select count(*) from public.clan_members where clan_id = p_clan) >= c.member_cap then raise exception 'That crew is full'; end if;
  select level into lvl from public.game_saves where owner_id = me;
  if coalesce(lvl, 1) < c.min_level then raise exception 'You need level % to join', c.min_level; end if;
  if c.join_mode = 'open' then
    insert into public.clan_members (owner_id, clan_id) values (me, p_clan);
    return 'joined';
  end if;
  if exists (select 1 from public.crew_join_requests where clan_id = p_clan and owner_id = me) then return 'requested'; end if;
  if (select count(*) from public.crew_join_requests where owner_id = me) >= 5 then raise exception 'You have 5 requests waiting. Cancel one first.'; end if;
  if (select count(*) from public.crew_join_requests where clan_id = p_clan) >= 30 then raise exception 'That crew has too many requests right now'; end if;
  insert into public.crew_join_requests (clan_id, owner_id) values (p_clan, me);
  return 'requested';
end $$;

create or replace function public.crew_cancel_request(p_clan uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.crew_join_requests where clan_id = p_clan and owner_id = auth.uid()
$$;

-- Crews the signed-in player has asked to join.
create or replace function public.crew_my_requests()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(clan_id order by created_at), '{}') from public.crew_join_requests where owner_id = auth.uid()
$$;

-- Requests waiting on the signed-in Leader or Co-Leader's crew: [{id, at}], oldest first.
create or replace function public.crew_requests()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m public.clan_members := public.crew_me();
begin
  if m.owner_id is null or not public.crew_is_officer(m.role) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.owner_id, 'at', r.created_at) order by r.created_at)
    from public.crew_join_requests r where r.clan_id = m.clan_id), '[]'::jsonb);
end $$;

-- Accept or turn down a request. Returns 'joined', 'declined' or 'gone' (they joined elsewhere or cancelled).
create or replace function public.crew_respond(p_owner uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  m public.clan_members := public.crew_me();
  c public.clans;
begin
  if m.owner_id is null or not public.crew_is_officer(m.role) then raise exception 'Only the Leader or a Co-Leader can do that'; end if;
  select * into c from public.clans where id = m.clan_id for update;
  if not exists (select 1 from public.crew_join_requests where clan_id = c.id and owner_id = p_owner) then return 'gone'; end if;
  if not coalesce(p_accept, false) then
    delete from public.crew_join_requests where clan_id = c.id and owner_id = p_owner;
    return 'declined';
  end if;
  if exists (select 1 from public.clan_members where owner_id = p_owner) then
    delete from public.crew_join_requests where clan_id = c.id and owner_id = p_owner;
    return 'gone';
  end if;
  if (select count(*) from public.clan_members where clan_id = c.id) >= c.member_cap then raise exception 'Your crew is full'; end if;
  insert into public.clan_members (owner_id, clan_id) values (p_owner, c.id);
  return 'joined';
end $$;

-- 5. Leaving, removing, ranks --------------------------------------------------------------------
-- The trigger hands the lead on, or closes the crew.
create or replace function public.leave_clan()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.clan_members where owner_id = auth.uid();
end $$;

-- Leader removes anyone; a Co-Leader removes Members only.
create or replace function public.kick_clan_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.clan_members := public.crew_me();
  them public.clan_members;
begin
  if me.owner_id is null or not public.crew_is_officer(me.role) then raise exception 'Only the Leader or a Co-Leader can do that'; end if;
  if p_member = me.owner_id then raise exception 'Use Leave instead'; end if;
  select * into them from public.clan_members where owner_id = p_member and clan_id = me.clan_id for update;
  if not found then return; end if;
  if them.role = 'leader' or (me.role = 'co_leader' and them.role <> 'member') then
    raise exception 'Only the Leader can do that';
  end if;
  delete from public.clan_members where owner_id = p_member and clan_id = me.clan_id;
end $$;

-- Leader only. p_rank: 'co_leader', 'member', or 'leader' (hands over the lead; the old Leader
-- becomes a Co-Leader).
create or replace function public.crew_set_rank(p_member uuid, p_rank text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.clan_members := public.crew_me();
begin
  if me.owner_id is null or me.role <> 'leader' then raise exception 'Only the Leader can do that'; end if;
  if p_member = me.owner_id then raise exception 'Pick another member'; end if;
  if p_rank not in ('leader', 'co_leader', 'member') then raise exception 'Unknown rank'; end if;
  perform 1 from public.clans where id = me.clan_id for update;
  if not exists (select 1 from public.clan_members where owner_id = p_member and clan_id = me.clan_id) then
    raise exception 'They are not in your crew';
  end if;
  if p_rank = 'leader' then
    update public.clan_members set role = 'co_leader' where owner_id = me.owner_id;
    update public.clan_members set role = 'leader' where owner_id = p_member;
    update public.clans set leader_id = p_member where id = me.clan_id;
  else
    update public.clan_members set role = p_rank where owner_id = p_member;
  end if;
end $$;

-- 6. Settings: Leader and Co-Leaders. p_join_mode is new and optional for the live client.
drop function if exists public.update_clan(text, text, text, int);
create or replace function public.update_clan(p_description text, p_emblem text, p_color text, p_min_level int, p_join_mode text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.clan_members := public.crew_me();
begin
  if me.owner_id is null or not public.crew_is_officer(me.role) then raise exception 'Only the Leader or a Co-Leader can do that'; end if;
  if not public.name_ok(p_description) then
    raise exception 'That name isn''t allowed. Try something else.';
  end if;
  if p_join_mode is not null and p_join_mode not in ('open', 'request', 'closed') then raise exception 'Unknown join setting'; end if;
  update public.clans set
    description = left(coalesce(p_description, description), 140),
    emblem = left(coalesce(nullif(p_emblem, ''), emblem), 8),
    color = coalesce(p_color, color),
    min_level = least(99, greatest(1, coalesce(p_min_level, min_level))),
    join_mode = coalesce(p_join_mode, join_mode)
  where id = me.clan_id;
  -- Closed: waiting requests can never be accepted, so they go.
  if p_join_mode = 'closed' then delete from public.crew_join_requests where clan_id = me.clan_id; end if;
end $$;

-- 7. Crew chat: Co-Leaders delete too ------------------------------------------------------------
create or replace function public.chat_is_room_leader(p_uid uuid, p_room text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_uid is not null and exists (
    select 1 from public.clan_members cm
    where cm.owner_id = p_uid and cm.role in ('leader', 'co_leader') and p_room = 'crew:' || cm.clan_id::text)
$$;
revoke all on function public.chat_is_room_leader(uuid, text) from public, anon, authenticated;

create or replace function public.chat_powers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'mod', public.chat_is_mod(auth.uid()),
    'leader', exists (select 1 from public.clan_members cm where cm.owner_id = auth.uid() and cm.role in ('leader', 'co_leader')))
$$;
revoke all on function public.chat_powers() from public, anon;
grant execute on function public.chat_powers() to authenticated;

-- 8. Grants --------------------------------------------------------------------------------------
revoke execute on function public.join_clan(uuid), public.leave_clan(), public.kick_clan_member(uuid),
  public.update_clan(text, text, text, int, text), public.crew_ask_join(uuid), public.crew_cancel_request(uuid),
  public.crew_my_requests(), public.crew_requests(), public.crew_respond(uuid, boolean), public.crew_set_rank(uuid, text)
  from public, anon;
grant execute on function public.join_clan(uuid), public.leave_clan(), public.kick_clan_member(uuid),
  public.update_clan(text, text, text, int, text), public.crew_ask_join(uuid), public.crew_cancel_request(uuid),
  public.crew_my_requests(), public.crew_requests(), public.crew_respond(uuid, boolean), public.crew_set_rank(uuid, text)
  to authenticated;
