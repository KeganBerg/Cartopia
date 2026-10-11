-- Crew weekly goal (standalone: replaces no existing function, leaves econ_guard/econ_catalog alone).
--
-- Every crew shares one target a week (Monday 00:00 UTC to Monday). Members add points by playing:
-- 1 per business collected (stats.jobs) and 3 per race (stats.races), counted on the server from
-- each save after the economy guard has checked it. When the crew reaches the target, every member
-- who chipped in at least 30 points that week opens a crew chest (open_crew_chest). A chest stays
-- openable through the following week, so nobody misses it over the weekend.
--
--   * Target: 120 points per member, counted as at least 3 members, so a solo crew isn't a free chest.
--   * A member's points count up to 3x their share (360), so the crew has to pull together.
--   * Points come out of a per-player bank that refills 1 point every 4 seconds (up to 240), so an
--     edited save can't dump thousands of jobs at once. Only the player's own saves count.
--   * One crew chest per player per week, whichever crew they were in. Rows in crew_chests are what
--     the save guard checks before it pays a chest (see the crewChests block in econ_guard()).

create or replace function public.crew_goal_rules() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"job":1,"race":3,"perMember":120,"minMembers":3,"memberCap":360,"minPoints":30,"bankMax":240,"bankSeconds":4}'::jsonb
$$;

-- Points each player added to a crew in a week.
create table if not exists public.crew_points (
  owner_id uuid not null references auth.users on delete cascade,
  clan_id uuid not null references public.clans on delete cascade,
  week_start date not null,
  jobs integer not null default 0,
  races integer not null default 0,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, clan_id, week_start)
);
create index if not exists crew_points_clan_week_idx on public.crew_points (clan_id, week_start);

-- When a crew first reached its target that week (kept, so a later join can't take it away).
create table if not exists public.crew_goal_reached (
  clan_id uuid not null references public.clans on delete cascade,
  week_start date not null,
  target integer not null,
  reached_at timestamptz not null default now(),
  primary key (clan_id, week_start)
);

-- How many points a player can still add right now.
create table if not exists public.crew_bank (
  owner_id uuid primary key references auth.users on delete cascade,
  bank numeric not null,
  at timestamptz not null default now()
);

-- Crew chests opened, one per player per week.
create table if not exists public.crew_chests (
  owner_id uuid not null references auth.users on delete cascade,
  week_start date not null,
  clan_id uuid,
  opened_at timestamptz not null default now(),
  primary key (owner_id, week_start)
);

alter table public.crew_points enable row level security;
alter table public.crew_goal_reached enable row level security;
alter table public.crew_bank enable row level security;
alter table public.crew_chests enable row level security;
drop policy if exists "crew points readable by all" on public.crew_points;
create policy "crew points readable by all" on public.crew_points for select using (true);
drop policy if exists "crew goals readable by all" on public.crew_goal_reached;
create policy "crew goals readable by all" on public.crew_goal_reached for select using (true);
drop policy if exists "players read their crew chests" on public.crew_chests;
create policy "players read their crew chests" on public.crew_chests for select using (owner_id = auth.uid());
-- No write policies: only the trigger and functions below write these.

-- The crew's target this week: per-member points for the current roster (at least minMembers).
create or replace function public.crew_target(p_clan uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select ((public.crew_goal_rules() ->> 'perMember')::int
          * greatest((select count(*) from public.clan_members where clan_id = p_clan), (public.crew_goal_rules() ->> 'minMembers')::int))::int
$$;

-- Points a crew has this week, each member's share capped.
create or replace function public.crew_total(p_clan uuid, p_week date) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(least(points, (public.crew_goal_rules() ->> 'memberCap')::int)), 0)::int
  from public.crew_points where clan_id = p_clan and week_start = p_week
$$;

-- Whether a crew has reached its target that week (recording it the first time it is seen).
create or replace function public.crew_reached(p_clan uuid, p_week date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  tgt int;
begin
  if exists (select 1 from public.crew_goal_reached where clan_id = p_clan and week_start = p_week) then
    return true;
  end if;
  -- Only the live week can still be reached; a past week is settled.
  if p_week <> public.this_week() then return false; end if;
  tgt := public.crew_target(p_clan);
  if public.crew_total(p_clan, p_week) >= tgt then
    insert into public.crew_goal_reached (clan_id, week_start, target) values (p_clan, p_week, tgt) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

-- After every save: credit new jobs and races to the player's crew.
create or replace function public.crew_track_points() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rules jsonb := public.crew_goal_rules();
  cid uuid;
  dj int;
  dr int;
  raw int;
  b numeric;
  got int;
  wk date := public.this_week();
begin
  -- Only the player's own saves count (not the SQL editor or server functions).
  if auth.uid() is distinct from new.owner_id then return new; end if;
  select clan_id into cid from public.clan_members where owner_id = new.owner_id;
  if cid is null then return new; end if;
  begin
    dj := greatest(0, least(coalesce((new.state #>> '{stats,jobs}')::numeric, 0) - coalesce((old.state #>> '{stats,jobs}')::numeric, 0), 100000))::int;
    dr := greatest(0, least(coalesce((new.state #>> '{stats,races}')::numeric, 0) - coalesce((old.state #>> '{stats,races}')::numeric, 0), 100000))::int;
  exception when others then
    return new;
  end;
  raw := dj * (rules ->> 'job')::int + dr * (rules ->> 'race')::int;
  if raw <= 0 then return new; end if;

  -- Spend from the bank, which refills with time.
  select least(k.bank + extract(epoch from now() - k.at) / (rules ->> 'bankSeconds')::numeric, (rules ->> 'bankMax')::numeric)
    into b from public.crew_bank k where k.owner_id = new.owner_id for update;
  if b is null then b := (rules ->> 'bankMax')::numeric; end if;
  got := least(raw, floor(b))::int;
  insert into public.crew_bank as k (owner_id, bank, at) values (new.owner_id, b - got, now())
    on conflict (owner_id) do update set bank = excluded.bank, at = excluded.at;
  if got <= 0 then return new; end if;

  -- Jobs and races are scaled down together when the bank runs short.
  insert into public.crew_points as p (owner_id, clan_id, week_start, jobs, races, points)
  values (new.owner_id, cid, wk, (dj * got / raw), (dr * got / raw), got)
  on conflict (owner_id, clan_id, week_start) do update set
    jobs = p.jobs + excluded.jobs, races = p.races + excluded.races, points = p.points + excluded.points, updated_at = now();
  perform public.crew_reached(cid, wk);
  return new;
exception when others then
  -- Crew points must never block a save.
  return new;
end $$;

drop trigger if exists crew_track_points on public.game_saves;
create trigger crew_track_points after update on public.game_saves
  for each row execute function public.crew_track_points();

-- Chests open only once the save guard knows how to pay them (econ_catalog() has `crew`), so nobody
-- opens one that the guard would then take back.
create or replace function public.crew_chest_payable() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.econ_catalog() ? 'crew', false)
$$;

-- One week's goal for a crew, as the game shows it.
create or replace function public.crew_week_view(p_clan uuid, p_week date, p_me uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rules jsonb := public.crew_goal_rules();
  reached boolean := public.crew_reached(p_clan, p_week);
  tgt int;
  mine int;
begin
  select coalesce(r.target, public.crew_target(p_clan)) into tgt
  from (select 1) one left join public.crew_goal_reached r on r.clan_id = p_clan and r.week_start = p_week;
  select coalesce(sum(points), 0)::int into mine from public.crew_points where clan_id = p_clan and week_start = p_week and owner_id = p_me;
  return jsonb_build_object(
    'week', p_week,
    'target', tgt,
    'points', public.crew_total(p_clan, p_week),
    'reached', reached,
    'mine', mine,
    'opened', exists (select 1 from public.crew_chests where owner_id = p_me and week_start = p_week),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', owner_id, 'points', least(points, (rules ->> 'memberCap')::int), 'jobs', jobs, 'races', races) order by points desc)
      from public.crew_points where clan_id = p_clan and week_start = p_week
    ), '[]')
  );
end $$;

-- The signed-in player's crew goal: this week, plus last week when its chest is still waiting.
create or replace function public.crew_goal() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
  wk date := public.this_week();
  last_clan uuid;
  rules jsonb := public.crew_goal_rules();
begin
  if me is null then return null; end if;
  select clan_id into cid from public.clan_members where owner_id = me;
  -- Last week's chest: any crew this player helped to its target and hasn't opened yet.
  if not exists (select 1 from public.crew_chests where owner_id = me and week_start = wk - 7) then
    select p.clan_id into last_clan from public.crew_points p
    join public.crew_goal_reached r on r.clan_id = p.clan_id and r.week_start = p.week_start
    where p.owner_id = me and p.week_start = wk - 7 and p.points >= (rules ->> 'minPoints')::int
    limit 1;
  end if;
  return jsonb_build_object(
    'rules', rules,
    'now', now(),
    'chests', (select count(*) from public.crew_chests where owner_id = me),
    'payable', public.crew_chest_payable(),
    'current', case when cid is null then null else public.crew_week_view(cid, wk, me) end,
    'last', case when last_clan is null then null else public.crew_week_view(last_clan, wk - 7, me) end
  );
end $$;

-- Opens this week's (or last week's) crew chest. The game then adds the reward to the save,
-- and the save guard pays one chest per row here.
create or replace function public.open_crew_chest(p_week date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.this_week();
  cid uuid;
  rules jsonb := public.crew_goal_rules();
begin
  if me is null then raise exception 'Sign in to open crew chests'; end if;
  if not public.crew_chest_payable() then raise exception 'Crew chests open soon'; end if;
  if p_week is null or p_week not in (wk, wk - 7) then raise exception 'That crew chest has expired'; end if;
  if exists (select 1 from public.crew_chests where owner_id = me and week_start = p_week) then
    raise exception 'You already opened that crew chest';
  end if;
  select p.clan_id into cid from public.crew_points p
  where p.owner_id = me and p.week_start = p_week and p.points >= (rules ->> 'minPoints')::int
    and public.crew_reached(p.clan_id, p_week)
  order by p.points desc limit 1;
  if cid is null then
    if exists (select 1 from public.crew_points where owner_id = me and week_start = p_week and public.crew_reached(clan_id, p_week)) then
      raise exception 'Add % crew points to earn the chest', (rules ->> 'minPoints');
    end if;
    raise exception 'Your crew has not reached its goal yet';
  end if;
  insert into public.crew_chests (owner_id, week_start, clan_id) values (me, p_week, cid);
  return (select count(*)::int from public.crew_chests where owner_id = me);
end $$;

revoke execute on function public.crew_track_points(), public.crew_week_view(uuid, date, uuid), public.crew_reached(uuid, date),
  public.crew_target(uuid), public.crew_total(uuid, date), public.crew_chest_payable() from public, anon, authenticated;
revoke execute on function public.crew_goal(), public.open_crew_chest(date) from public, anon;
grant execute on function public.crew_goal(), public.open_crew_chest(date) to authenticated;
grant execute on function public.crew_goal_rules() to anon, authenticated;
grant select on public.crew_points, public.crew_goal_reached, public.crew_chests to anon, authenticated;
