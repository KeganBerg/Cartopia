-- Crew battles (src/lib/battles.ts, src/ui/CrewBattle.tsx), 2026-10-11. Standalone: no econ_catalog()
-- or econ_guard() change. Needs 0027_crew_weekly_goal.sql (crew_chests) and 0009 (live_races).
--
-- Every week (Monday 00:00 UTC to Monday) each crew is matched against one rival crew and the two
-- race for the most battle points:
--   * race run +1, race won +3 more, counted on the server from each save after the economy guard
--     has checked it (stats.races, and the guard's own race_wins column);
--   * a live race won against any signed-in player +10, or +25 against a member of the rival crew
--     (from the refereed live_races rows; forfeits don't count, at most 3 a day per pair of players).
--   * Save points come out of a per-player bank that refills 1 point every 3 seconds (up to 300),
--     and a member's points count up to 500 a week, so one grinder can't carry a crew.
-- Matching happens the first time a crew is seen in a week: the active crew without a battle yet
-- that is closest in size and power, or else a street crew run by the server (bot), whose score
-- climbs through the week on a fixed curve sized to the crew (45 points a member, at least 2).
-- When the week ends, members of the winning crew (both, on a draw) who scored at least 20 points
-- claim a victory chest during the following week, and the winning crew's top scorer a second
-- (MVP) chest. Both are rows in public.crew_chests, which the save guard already pays as crew
-- chests: kind 'battle' dated the battle's Monday + 1 day, kind 'mvp' + 2 days, so they never clash
-- with weekly-goal chests (dated the Monday).

create or replace function public.crew_battle_rules() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"race":1,"win":3,"live":10,"h2h":25,"livePerRival":3,"memberCap":500,"minPoints":20,"bankMax":300,"bankSeconds":3,"botPerMember":45,"botMinMembers":2}'::jsonb
$$;

-- One battle a week per crew. b is null when the rival is a street crew (bot).
create table if not exists public.crew_battles (
  id bigint generated always as identity primary key,
  week_start date not null,
  a uuid references public.clans on delete set null,
  b uuid references public.clans on delete set null,
  bot jsonb,
  venue text not null default 'main',
  created_at timestamptz not null default now()
);
create unique index if not exists crew_battles_a_idx on public.crew_battles (week_start, a);
create unique index if not exists crew_battles_b_idx on public.crew_battles (week_start, b) where b is not null;

-- Points each player scored for a crew in a week.
create table if not exists public.battle_points (
  owner_id uuid not null references auth.users on delete cascade,
  clan_id uuid not null references public.clans on delete cascade,
  week_start date not null,
  races integer not null default 0,
  wins integer not null default 0,
  live integer not null default 0,
  h2h integer not null default 0,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, clan_id, week_start)
);
create index if not exists battle_points_clan_week_idx on public.battle_points (clan_id, week_start);

create table if not exists public.battle_bank (
  owner_id uuid primary key references auth.users on delete cascade,
  bank numeric not null,
  at timestamptz not null default now()
);

-- Live race wins already counted (one row per race).
create table if not exists public.battle_live (
  race_id text primary key,
  winner uuid not null references auth.users on delete cascade,
  loser uuid not null references auth.users on delete cascade,
  at timestamptz not null default now()
);
create index if not exists battle_live_pair_idx on public.battle_live (winner, loser, at);

-- Which chest a crew_chests row is: the weekly goal's, a battle victory, or a battle MVP.
alter table public.crew_chests add column if not exists kind text not null default 'goal';

alter table public.crew_battles enable row level security;
alter table public.battle_points enable row level security;
alter table public.battle_bank enable row level security;
alter table public.battle_live enable row level security;
drop policy if exists "crew battles readable by all" on public.crew_battles;
create policy "crew battles readable by all" on public.crew_battles for select using (true);
drop policy if exists "battle points readable by all" on public.battle_points;
create policy "battle points readable by all" on public.battle_points for select using (true);
-- No write policies: only the triggers and functions below write these.
revoke insert, update, delete on public.crew_battles, public.battle_points, public.battle_bank, public.battle_live from anon, authenticated;

-- A number 0..1 from text, for the street crews' fixed rolls.
create or replace function econ_private.battle_roll(seed text) returns numeric
language sql immutable set search_path = '' as $$
  select ('x' || substr(md5(seed), 1, 8))::bit(32)::bigint::numeric / 4294967296
$$;

-- A street crew sized to the crew it meets: name, look, members and the score it will reach.
create or replace function econ_private.battle_bot(p_clan uuid, p_week date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  rules jsonb := public.crew_battle_rules();
  seed text := p_clan::text || p_week::text;
  crews text[] := array['Rust Belt Rollers|RBR', 'Midnight Mufflers|MMF', 'Chrome Coyotes|CHC', 'Gravel Ghosts|GGH',
    'Neon Nomads|NEO', 'Torque Tribe|TQT', 'Velvet Pistons|VPS', 'Asphalt Owls|OWL', 'Turbo Tortoises|TRT',
    'Redline Rascals|RLR', 'Backfire Bandits|BFB', 'Dune Drifters|DDR', 'Harbor Hounds|HHD', 'Frost Fangs|FFG'];
  emblems text[] := array['🏁', '🔥', '⚡', '🦅', '🐺', '💀', '👑', '🚀', '🐉', '⭐', '🏎️', '🛞'];
  colors text[] := array['#ff7043', '#e53935', '#8e24aa', '#1e88e5', '#00897b', '#43a047', '#fdd835', '#546e7a'];
  drivers text[] := array['Dusty Vance', 'Gearbox Gil', 'Lola Lugnut', 'Skid Marlowe', 'Penny Piston', 'Hal Hubcap',
    'Rosa Redline', 'Bo Burnout', 'Ziggy Zorn', 'Mags Malone', 'Tex Torque', 'Ivy Ignition', 'Cruz Clutch',
    'Nova Knox', 'Rex Radiator', 'Juno Jetstream', 'Otis Overdrive', 'Sunny Shifter'];
  n int;
  pick text[];
  diff numeric;
  members jsonb := '[]';
  i int;
  won_last boolean;
  first int := floor(econ_private.battle_roll(seed || 'driver') * 18)::int;
begin
  select count(*) into n from public.clan_members where clan_id = p_clan;
  n := greatest(n, (rules ->> 'botMinMembers')::int);
  pick := string_to_array(crews[1 + floor(econ_private.battle_roll(seed || 'name') * array_length(crews, 1))::int], '|');
  -- 0.80 to 1.15 of par, a little tougher after a win.
  diff := 0.8 + econ_private.battle_roll(seed || 'diff') * 0.35;
  select public.crew_battle_result(x.id, p_clan) = 'win' into won_last from public.crew_battles x
    where x.week_start = p_week - 7 and p_clan in (x.a, x.b);
  if coalesce(won_last, false) then diff := diff + 0.1; end if;
  for i in 1 .. least(greatest(n, 3), 6) loop
    members := members || jsonb_build_array(jsonb_build_object(
      'name', drivers[1 + (first + i * 7) % array_length(drivers, 1)],
      'w', round(0.4 + econ_private.battle_roll(seed || 'w' || i) * 1.2, 2)));
  end loop;
  return jsonb_build_object(
    'name', pick[1], 'tag', pick[2],
    'emblem', emblems[1 + floor(econ_private.battle_roll(seed || 'emblem') * array_length(emblems, 1))::int],
    'color', colors[1 + floor(econ_private.battle_roll(seed || 'color') * array_length(colors, 1))::int],
    'total', round((rules ->> 'botPerMember')::int * n * diff)::int,
    'members', members);
end $$;

-- A street crew's score at a moment: it races in bursts through the week (an hour at a time, some
-- hours idle) and reaches its total as the week ends.
create or replace function econ_private.battle_bot_score(p_bot jsonb, p_seed text, p_week date, p_at timestamptz) returns integer
language sql stable set search_path = '' as $$
  with hours as (
    select h, case when econ_private.battle_roll(p_seed || 'h' || h) < 0.45 then 0
                   else econ_private.battle_roll(p_seed || 'v' || h) end as w
    from generate_series(0, 167) h
  ), t as (
    select least(greatest(extract(epoch from p_at - p_week::timestamp at time zone 'utc') / 3600, 0), 168) as e
  )
  select floor((p_bot ->> 'total')::numeric
    * coalesce((select sum(w * least(greatest(t.e - h, 0), 1)) from hours, t) / nullif((select sum(w) from hours), 0), 0))::int
$$;

-- A side's score in a battle.
create or replace function public.crew_battle_score(p_battle bigint, p_clan uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  x public.crew_battles;
begin
  select * into x from public.crew_battles where id = p_battle;
  if x.id is null or p_clan is null then return 0; end if;
  return coalesce((select sum(least(points, (public.crew_battle_rules() ->> 'memberCap')::int))
    from public.battle_points where clan_id = p_clan and week_start = x.week_start), 0)::int;
end $$;

-- The other side's score: the rival crew's, or the street crew's so far.
create or replace function public.crew_battle_rival_score(p_battle bigint, p_clan uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  x public.crew_battles;
begin
  select * into x from public.crew_battles where id = p_battle;
  if x.id is null then return 0; end if;
  if x.bot is not null then
    return econ_private.battle_bot_score(x.bot, x.id::text, x.week_start, least(now(), x.week_start::timestamp at time zone 'utc' + interval '7 days'));
  end if;
  return public.crew_battle_score(p_battle, case when p_clan = x.a then x.b else x.a end);
end $$;

-- 'win', 'loss' or 'draw' for a crew once its battle's week is over (null while it's on).
create or replace function public.crew_battle_result(p_battle bigint, p_clan uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  x public.crew_battles;
  us int;
  them int;
begin
  select * into x from public.crew_battles where id = p_battle;
  if x.id is null or x.week_start >= public.this_week() then return null; end if;
  us := public.crew_battle_score(p_battle, p_clan);
  them := public.crew_battle_rival_score(p_battle, p_clan);
  return case when us > them then 'win' when us < them then 'loss' else 'draw' end;
end $$;

-- This week's battle for a crew, matching it with a rival the first time it's asked for.
create or replace function public.crew_battle_of(p_clan uuid) returns public.crew_battles
language plpgsql security definer set search_path = '' as $$
declare
  wk date := public.this_week();
  x public.crew_battles;
  my_pw numeric;
  my_n int;
  opp uuid;
  venues text[] := array['main', 'beach', 'desert', 'snow', 'farm', 'docks'];
begin
  if p_clan is null then return null; end if;
  select * into x from public.crew_battles where week_start = wk and p_clan in (a, b);
  if x.id is not null then return x; end if;
  perform pg_advisory_xact_lock(hashtext('crew_battle:' || wk::text));
  select * into x from public.crew_battles where week_start = wk and p_clan in (a, b);
  if x.id is not null then return x; end if;

  select coalesce(sum(g.power), 0), count(*) into my_pw, my_n
    from public.clan_members m left join public.game_saves g on g.owner_id = m.owner_id where m.clan_id = p_clan;
  -- The closest active crew still free this week: someone in it played in the last two weeks,
  -- and it's no more than three times stronger or weaker.
  select c.id into opp from (
    select m.clan_id as id, coalesce(sum(g.power), 0) as pw, count(*) as n, max(g.updated_at) as seen
    from public.clan_members m left join public.game_saves g on g.owner_id = m.owner_id
    where m.clan_id <> p_clan
    group by m.clan_id
  ) c
  where c.seen > now() - interval '14 days'
    and not exists (select 1 from public.crew_battles y where y.week_start = wk and c.id in (y.a, y.b))
    and greatest(c.pw, 1) <= greatest(my_pw, 1) * 3 and greatest(my_pw, 1) <= greatest(c.pw, 1) * 3
  order by abs(ln(greatest(c.pw, 1)) - ln(greatest(my_pw, 1))) + abs(c.n - my_n) * 0.15, c.id
  limit 1;

  insert into public.crew_battles (week_start, a, b, bot, venue)
  values (wk, p_clan, opp, case when opp is null then econ_private.battle_bot(p_clan, wk) end,
          venues[1 + floor(econ_private.battle_roll(p_clan::text || wk::text || 'venue') * 6)::int])
  returning * into x;
  return x;
end $$;

-- Adds points to a player's crew this week.
create or replace function econ_private.battle_add(p_owner uuid, p_clan uuid, p_races int, p_wins int, p_live int, p_h2h int, p_points int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_points <= 0 then return; end if;
  perform public.crew_battle_of(p_clan);
  insert into public.battle_points as p (owner_id, clan_id, week_start, races, wins, live, h2h, points)
  values (p_owner, p_clan, public.this_week(), p_races, p_wins, p_live, p_h2h, p_points)
  on conflict (owner_id, clan_id, week_start) do update set
    races = p.races + excluded.races, wins = p.wins + excluded.wins, live = p.live + excluded.live,
    h2h = p.h2h + excluded.h2h, points = p.points + excluded.points, updated_at = now();
end $$;

-- After every save: races run and won since the last one.
create or replace function public.crew_battle_track() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rules jsonb := public.crew_battle_rules();
  cid uuid;
  dr int;
  dw int;
  raw int;
  b numeric;
  got int;
begin
  -- Only the player's own saves count (not the SQL editor or server functions).
  if auth.uid() is distinct from new.owner_id then return new; end if;
  select clan_id into cid from public.clan_members where owner_id = new.owner_id;
  if cid is null then return new; end if;
  begin
    dr := greatest(0, least(coalesce((new.state #>> '{stats,races}')::numeric, 0) - coalesce((old.state #>> '{stats,races}')::numeric, 0), 100000))::int;
  exception when others then
    dr := 0;
  end;
  -- race_wins is the guard's own count, already checked.
  dw := greatest(0, least(coalesce(new.race_wins, 0) - coalesce(old.race_wins, 0), 100000));
  dr := greatest(dr, dw);
  raw := dr * (rules ->> 'race')::int + dw * (rules ->> 'win')::int;
  if raw <= 0 then return new; end if;

  select least(k.bank + extract(epoch from now() - k.at) / (rules ->> 'bankSeconds')::numeric, (rules ->> 'bankMax')::numeric)
    into b from public.battle_bank k where k.owner_id = new.owner_id for update;
  if b is null then b := (rules ->> 'bankMax')::numeric; end if;
  got := least(raw, floor(b))::int;
  insert into public.battle_bank as k (owner_id, bank, at) values (new.owner_id, b - got, now())
    on conflict (owner_id) do update set bank = excluded.bank, at = excluded.at;
  if got <= 0 then return new; end if;
  -- Races and wins are scaled down together when the bank runs short.
  perform econ_private.battle_add(new.owner_id, cid, dr * got / raw, dw * got / raw, 0, 0, got);
  return new;
exception when others then
  -- Battle points must never block a save.
  return new;
end $$;

drop trigger if exists crew_battle_track on public.game_saves;
create trigger crew_battle_track after update on public.game_saves
  for each row execute function public.crew_battle_track();

-- When a live race is decided: the winner's crew gets the live bonus, more against the rival crew.
create or replace function public.crew_battle_live() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rules jsonb := public.crew_battle_rules();
  v_loser uuid;
  cid uuid;
  their uuid;
  x public.crew_battles;
  h2h boolean;
begin
  if old.winner is not null or new.winner is null or new.void or new.forfeit then return new; end if;
  v_loser := case when new.winner = new.a then new.b else new.a end;
  select clan_id into cid from public.clan_members where owner_id = new.winner;
  if cid is null then return new; end if;
  if (select count(*) from public.battle_live where winner = new.winner and loser = v_loser and at > now() - interval '1 day')
     >= (rules ->> 'livePerRival')::int then
    return new;
  end if;
  insert into public.battle_live (race_id, winner, loser) values (new.id, new.winner, v_loser) on conflict do nothing;
  if not found then return new; end if;
  select clan_id into their from public.clan_members where owner_id = v_loser;
  x := public.crew_battle_of(cid);
  h2h := their is not null and their <> cid and their in (x.a, x.b);
  perform econ_private.battle_add(new.winner, cid, 0, 0, 1, case when h2h then 1 else 0 end,
    case when h2h then (rules ->> 'h2h')::int else (rules ->> 'live')::int end);
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists crew_battle_live on public.live_races;
create trigger crew_battle_live after update on public.live_races
  for each row execute function public.crew_battle_live();

-- One side of a battle as the game shows it.
create or replace function econ_private.battle_side(x public.crew_battles, p_clan uuid, p_bot boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  rules jsonb := public.crew_battle_rules();
  c public.clans;
  score int;
  wsum numeric;
begin
  if p_bot then
    score := public.crew_battle_rival_score(x.id, x.a);
    select sum((m ->> 'w')::numeric) into wsum from jsonb_array_elements(x.bot -> 'members') m;
    return jsonb_build_object('bot', true, 'name', x.bot ->> 'name', 'tag', x.bot ->> 'tag', 'emblem', x.bot ->> 'emblem',
      'color', x.bot ->> 'color', 'score', score,
      'members', (select jsonb_agg(jsonb_build_object('id', 'bot' || i, 'name', m ->> 'name',
                    'points', floor(score * (m ->> 'w')::numeric / wsum)::int) order by (m ->> 'w')::numeric desc)
                  from jsonb_array_elements(x.bot -> 'members') with ordinality as e(m, i)));
  end if;
  select * into c from public.clans where id = p_clan;
  return jsonb_build_object('bot', false, 'id', p_clan, 'name', coalesce(c.name, ''), 'tag', coalesce(c.tag, ''),
    'emblem', coalesce(c.emblem, '🏁'), 'color', coalesce(c.color, '#546e7a'),
    'score', public.crew_battle_score(x.id, p_clan),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.owner_id, 'name', coalesce(g.town_name, ''), 'points', least(p.points, (rules ->> 'memberCap')::int),
        'races', p.races, 'wins', p.wins, 'live', p.live, 'h2h', p.h2h) order by p.points desc, p.updated_at)
      from public.battle_points p left join public.game_saves g on g.owner_id = p.owner_id
      where p.clan_id = p_clan and p.week_start = x.week_start and p_clan is not null), '[]'));
end $$;

-- A battle from one crew's side: us, them, the result once it's over and what this player can claim.
create or replace function econ_private.battle_view(x public.crew_battles, p_clan uuid, p_me uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  rules jsonb := public.crew_battle_rules();
  rival uuid := case when p_clan = x.a then x.b else x.a end;
  res text := public.crew_battle_result(x.id, p_clan);
  mine int;
  top uuid;
begin
  select coalesce(sum(points), 0)::int into mine from public.battle_points where clan_id = p_clan and week_start = x.week_start and owner_id = p_me;
  select owner_id into top from public.battle_points where clan_id = p_clan and week_start = x.week_start order by points desc, updated_at limit 1;
  return jsonb_build_object(
    'week', x.week_start, 'venue', x.venue, 'result', res, 'mine', mine, 'mvp', top = p_me,
    'us', econ_private.battle_side(x, p_clan, false),
    'them', econ_private.battle_side(x, rival, x.bot is not null),
    'claimed', (select coalesce(jsonb_agg(kind), '[]') from public.crew_chests
                where owner_id = p_me and week_start in (x.week_start + 1, x.week_start + 2) and kind in ('battle', 'mvp')));
end $$;

-- The signed-in player's crew battle: this week's, last week's (for its result and chests), and the crew's record.
create or replace function public.crew_battle() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
  wk date := public.this_week();
  cur public.crew_battles;
  prev public.crew_battles;
  prev_clan uuid;
  w int := 0;
  l int := 0;
  d int := 0;
  streak int := 0;
  counting boolean := true;
  r record;
  res text;
begin
  if me is null then return null; end if;
  select clan_id into cid from public.clan_members where owner_id = me;
  if cid is not null then cur := public.crew_battle_of(cid); end if;
  -- Last week: the crew this player scored most for, or else their crew now.
  select p.clan_id into prev_clan from public.battle_points p where p.owner_id = me and p.week_start = wk - 7 order by p.points desc limit 1;
  prev_clan := coalesce(prev_clan, cid);
  if prev_clan is not null then
    select * into prev from public.crew_battles where week_start = wk - 7 and prev_clan in (a, b);
  end if;
  if cid is not null then
    for r in select id from public.crew_battles where cid in (a, b) and week_start < wk order by week_start desc limit 52 loop
      res := public.crew_battle_result(r.id, cid);
      if res = 'win' then w := w + 1; elsif res = 'loss' then l := l + 1; else d := d + 1; end if;
      if counting and res = 'win' then streak := streak + 1; else counting := false; end if;
    end loop;
  end if;
  return jsonb_build_object(
    'rules', public.crew_battle_rules(),
    'now', now(),
    'payable', public.crew_chest_payable(),
    'chests', (select count(*) from public.crew_chests where owner_id = me),
    'record', jsonb_build_object('wins', w, 'losses', l, 'draws', d, 'streak', streak),
    'current', case when cur.id is null then null else econ_private.battle_view(cur, cid, me) end,
    'last', case when prev.id is null then null else econ_private.battle_view(prev, prev_clan, me) end);
end $$;

-- Claims last week's battle chests: a victory chest for scoring 20+ for a crew that won or drew,
-- and the MVP chest for the winning crew's top scorer. Returns the player's crew chest count, which
-- the game pays up to (the save guard pays one crew chest per crew_chests row).
create or replace function public.crew_battle_claim(p_week date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  rules jsonb := public.crew_battle_rules();
  r record;
  x public.crew_battles;
  res text;
  top uuid;
  paid boolean := false;
begin
  if me is null then raise exception 'Sign in to claim battle chests'; end if;
  if not public.crew_chest_payable() then raise exception 'Battle chests open soon'; end if;
  if p_week is null or p_week <> public.this_week() - 7 then raise exception 'That battle chest has expired'; end if;
  perform pg_advisory_xact_lock(hashtext('crew_battle_claim:' || me::text));
  for r in select clan_id, points from public.battle_points where owner_id = me and week_start = p_week order by points desc loop
    select * into x from public.crew_battles where week_start = p_week and r.clan_id in (a, b);
    continue when x.id is null;
    res := public.crew_battle_result(x.id, r.clan_id);
    continue when res is null or res = 'loss';
    if r.points < (rules ->> 'minPoints')::int then
      raise exception 'Score % battle points to earn the chest', (rules ->> 'minPoints');
    end if;
    insert into public.crew_chests (owner_id, week_start, clan_id, kind) values (me, p_week + 1, r.clan_id, 'battle') on conflict do nothing;
    if res = 'win' then
      select owner_id into top from public.battle_points where clan_id = r.clan_id and week_start = p_week order by points desc, updated_at limit 1;
      if top = me then
        insert into public.crew_chests (owner_id, week_start, clan_id, kind) values (me, p_week + 2, r.clan_id, 'mvp') on conflict do nothing;
      end if;
    end if;
    paid := true;
    exit;
  end loop;
  if not paid then
    if res = 'loss' then raise exception 'Your crew lost that battle'; end if;
    raise exception 'No battle chest to claim';
  end if;
  return (select count(*)::int from public.crew_chests where owner_id = me);
end $$;

revoke execute on function public.crew_battle_track(), public.crew_battle_live(), public.crew_battle_of(uuid),
  public.crew_battle_score(bigint, uuid), public.crew_battle_rival_score(bigint, uuid), public.crew_battle_result(bigint, uuid),
  econ_private.battle_roll(text), econ_private.battle_bot(uuid, date), econ_private.battle_bot_score(jsonb, text, date, timestamptz),
  econ_private.battle_add(uuid, uuid, int, int, int, int, int), econ_private.battle_side(public.crew_battles, uuid, boolean),
  econ_private.battle_view(public.crew_battles, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.crew_battle(), public.crew_battle_claim(date) from public, anon;
grant execute on function public.crew_battle(), public.crew_battle_claim(date) to authenticated;
grant execute on function public.crew_battle_rules() to anon, authenticated;
grant select on public.crew_battles, public.battle_points to anon, authenticated;
