-- Leaderboard stats on each save, weekly gains, and player clans.

-- Public summary columns the client fills on every save.
alter table public.game_saves
  add column trophies integer not null default 0,
  add column race_wins integer not null default 0,
  add column power integer not null default 0;

update public.game_saves set
  trophies = coalesce((state->>'trophies')::int, 0),
  race_wins = coalesce((state->>'racesWon')::int, 0);

-- Older clients only send the save blob, so read trophies and wins out of it.
create or replace function public.fill_save_stats() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.trophies := coalesce((new.state->>'trophies')::int, new.trophies, 0);
  new.race_wins := coalesce((new.state->>'racesWon')::int, new.race_wins, 0);
  return new;
end $$;

create trigger game_saves_fill_stats before insert or update on public.game_saves
  for each row execute function public.fill_save_stats();

-- Gains per player per week (weeks start Monday, UTC).
create table public.weekly_stats (
  owner_id uuid not null references auth.users on delete cascade,
  week_start date not null,
  trophies integer not null default 0,
  race_wins integer not null default 0,
  power integer not null default 0,
  levels integer not null default 0,
  primary key (owner_id, week_start)
);

alter table public.weekly_stats enable row level security;
create policy "weekly stats readable by all" on public.weekly_stats for select using (true);

create or replace function public.this_week() returns date
language sql stable set search_path = '' as $$
  select (date_trunc('week', now() at time zone 'utc'))::date
$$;

-- Every save that raises a stat adds the gain to this week's row.
create or replace function public.track_weekly_gains() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dt int := greatest(0, new.trophies - old.trophies);
  dw int := greatest(0, new.race_wins - old.race_wins);
  -- A first power reading is a baseline, not a weekly gain.
  dp int := case when old.power = 0 then 0 else greatest(0, new.power - old.power) end;
  dl int := greatest(0, new.level - old.level);
begin
  if dt + dw + dp + dl > 0 then
    insert into public.weekly_stats as w (owner_id, week_start, trophies, race_wins, power, levels)
    values (new.owner_id, public.this_week(), dt, dw, dp, dl)
    on conflict (owner_id, week_start) do update set
      trophies = w.trophies + excluded.trophies,
      race_wins = w.race_wins + excluded.race_wins,
      power = w.power + excluded.power,
      levels = w.levels + excluded.levels;
  end if;
  return new;
end $$;

create trigger game_saves_weekly after update on public.game_saves
  for each row execute function public.track_weekly_gains();

-- Clans: anyone signed in can start one, join an open one, or leave.
create table public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 24),
  tag text not null check (tag ~ '^[A-Z0-9]{2,4}$'),
  emblem text not null default '🏁',
  color text not null default '#ff7043' check (color ~ '^#[0-9a-fA-F]{6}$'),
  description text not null default '' check (char_length(description) <= 140),
  leader_id uuid not null references auth.users on delete cascade,
  member_cap integer not null default 20 check (member_cap between 2 and 50),
  min_level integer not null default 1 check (min_level between 1 and 99),
  created_at timestamptz not null default now()
);
create unique index clans_name_key on public.clans (lower(name));
create unique index clans_tag_key on public.clans (tag);

create table public.clan_members (
  owner_id uuid primary key references auth.users on delete cascade,
  clan_id uuid not null references public.clans on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now()
);
create index clan_members_clan_idx on public.clan_members (clan_id);

alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
create policy "clans readable by all" on public.clans for select using (true);
create policy "clan members readable by all" on public.clan_members for select using (true);
-- No write policies: every change goes through the functions below.

create or replace function public.create_clan(p_name text, p_tag text, p_emblem text, p_color text, p_description text, p_min_level int default 1)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'Sign in to start a clan'; end if;
  if exists (select 1 from public.clan_members where owner_id = me) then raise exception 'Leave your current clan first'; end if;
  if exists (select 1 from public.clans where lower(name) = lower(trim(p_name))) then raise exception 'That clan name is taken'; end if;
  if exists (select 1 from public.clans where tag = upper(trim(p_tag))) then raise exception 'That tag is taken'; end if;
  insert into public.clans (name, tag, emblem, color, description, leader_id, min_level)
  values (trim(p_name), upper(trim(p_tag)), left(coalesce(nullif(p_emblem, ''), '🏁'), 8), coalesce(p_color, '#ff7043'), left(coalesce(p_description, ''), 140), me, greatest(1, coalesce(p_min_level, 1)))
  returning id into cid;
  insert into public.clan_members (owner_id, clan_id, role) values (me, cid, 'leader');
  return cid;
end $$;

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
  if (select count(*) from public.clan_members where clan_id = p_clan) >= c.member_cap then raise exception 'That clan is full'; end if;
  select level into lvl from public.game_saves where owner_id = me;
  if coalesce(lvl, 1) < c.min_level then raise exception 'You need level % to join', c.min_level; end if;
  insert into public.clan_members (owner_id, clan_id) values (me, p_clan);
end $$;

-- Leaving hands the lead to the longest-serving member; the last one out closes the clan.
create or replace function public.leave_clan()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.clan_members;
  heir uuid;
begin
  select * into m from public.clan_members where owner_id = me;
  if not found then return; end if;
  delete from public.clan_members where owner_id = me;
  if m.role = 'leader' then
    select owner_id into heir from public.clan_members where clan_id = m.clan_id order by joined_at limit 1;
    if heir is null then
      delete from public.clans where id = m.clan_id;
    else
      update public.clan_members set role = 'leader' where owner_id = heir;
      update public.clans set leader_id = heir where id = m.clan_id;
    end if;
  end if;
end $$;

create or replace function public.kick_clan_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  select clan_id into cid from public.clan_members where owner_id = me and role = 'leader';
  if cid is null then raise exception 'Only the clan leader can do that'; end if;
  if p_member = me then raise exception 'Use Leave instead'; end if;
  delete from public.clan_members where owner_id = p_member and clan_id = cid;
end $$;

create or replace function public.update_clan(p_description text, p_emblem text, p_color text, p_min_level int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  update public.clans set
    description = left(coalesce(p_description, description), 140),
    emblem = left(coalesce(nullif(p_emblem, ''), emblem), 8),
    color = coalesce(p_color, color),
    min_level = greatest(1, coalesce(p_min_level, min_level))
  where leader_id = me;
  if not found then raise exception 'Only the clan leader can do that'; end if;
end $$;

revoke execute on function public.create_clan, public.join_clan, public.leave_clan, public.kick_clan_member, public.update_clan, public.track_weekly_gains, public.fill_save_stats from public, anon;
grant execute on function public.create_clan, public.join_clan, public.leave_clan, public.kick_clan_member, public.update_clan to authenticated;

-- Player boards: all-time totals plus this week's gains, with clan tag.
create view public.player_leaderboard with (security_invoker = true) as
select
  g.owner_id, g.town_name, g.level, g.trophies, g.race_wins, g.power,
  coalesce(w.trophies, 0) as week_trophies,
  coalesce(w.race_wins, 0) as week_race_wins,
  coalesce(w.power, 0) as week_power,
  coalesce(w.levels, 0) as week_levels,
  c.id as clan_id, c.tag as clan_tag, c.emblem as clan_emblem, c.color as clan_color
from public.game_saves g
left join public.weekly_stats w on w.owner_id = g.owner_id and w.week_start = public.this_week()
left join public.clan_members m on m.owner_id = g.owner_id
left join public.clans c on c.id = m.clan_id;

-- Clan boards: member totals, all-time and this week.
create view public.clan_leaderboard with (security_invoker = true) as
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
  coalesce(sum(p.week_levels), 0)::int as week_levels
from public.clans c
left join public.clan_members m on m.clan_id = c.id
left join public.player_leaderboard p on p.owner_id = m.owner_id
group by c.id;

grant select on public.player_leaderboard, public.clan_leaderboard to anon, authenticated;
