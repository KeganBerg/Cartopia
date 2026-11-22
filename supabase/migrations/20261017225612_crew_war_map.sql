-- 0114 Crew war map (2026-10-17; Kegan: "I want both enemy and ally to see the war and users within the crews racing
-- each other on a war map"). Thread "Crew members, settings, ranks and Social menu". Needs 0050 (crew battles), 0030 +
-- 0052 (ghost races, race_floor) and 0113 (war chests). No econ_guard() or econ_catalog() change, no prizes of its own:
-- attacks add war points, which the war chests and victory chests already pay for.
--  1. War attacks: a member races a rival crew member's ghost (their best run, or a par for their best car, as in
--     friend ghost races). A street crew's drivers race a par for the attacker's own car, tougher for its stronger
--     drivers. Timed like ghost races: war_attack_start before the countdown, war_attack_submit after the line; the
--     time can't beat the wall clock between them and is raised to race_floor() of the attacker's saved best car.
--  2. Stars: a win is 1 star, 2 by 1% or more, 3 by 3% or more; each star is 5 war points. 3 attacks a player a UTC day;
--     an attack started and not finished counts as a loss when the next one starts.
--  3. Both crews see every attack: crew_battle() gains "attacks" (this war's, newest first, from this crew's side),
--     "attacksLeft" and each real side's full "roster" (every member with their ghost's car and time), so the map
--     shows who beat whom and who is still standing.
-- Running this file again changes nothing.

create or replace function public.crew_war_rules() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"attacksPerDay":3,"starPoints":5,"star2":0.01,"star3":0.03}'::jsonb
$$;

create table if not exists public.war_attacks (
  id bigint generated always as identity primary key,
  battle_id bigint not null references public.crew_battles on delete cascade,
  attacker uuid not null references auth.users on delete cascade,
  attacker_clan uuid,
  -- A rival member's account id, or 'bot1'.. for a street crew's drivers.
  target text not null,
  won boolean not null,
  t numeric not null,
  their numeric not null,
  stars smallint not null default 0,
  points int not null default 0,
  at timestamptz not null default now()
);
create index if not exists war_attacks_battle_idx on public.war_attacks (battle_id, at desc);
create index if not exists war_attacks_day_idx on public.war_attacks (attacker, at);

-- The attack in progress (one at a time).
create table if not exists public.war_runs (
  owner_id uuid primary key references auth.users on delete cascade,
  battle_id bigint not null,
  clan_id uuid not null,
  target text not null,
  their numeric not null,
  started_at timestamptz not null default now()
);

alter table public.war_attacks enable row level security;
alter table public.war_runs enable row level security;
revoke all on public.war_attacks, public.war_runs from anon, authenticated;

-- Attacks this player has finished today (UTC).
create or replace function econ_private.war_attacks_today(p_me uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.war_attacks
  where attacker = p_me and at >= (now() at time zone 'utc')::date::timestamp at time zone 'utc'
$$;

-- Starts an attack on a rival: p_target is a rival member's account id, or 'bot1'.. for a street crew's drivers.
-- Returns the time to beat and the attacks left after this one.
create or replace function public.war_attack_start(p_target text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  rules jsonb := public.crew_war_rules();
  cid uuid;
  x public.crew_battles;
  rival uuid;
  my_pi int;
  their numeric;
  w numeric;
  i int;
  old public.war_runs;
begin
  if me is null then raise exception 'Sign in to race in the crew war' using errcode = 'insufficient_privilege'; end if;
  select clan_id into cid from public.clan_members where owner_id = me;
  if cid is null then raise exception 'Join a crew to race in the crew war'; end if;
  select (g.best_car ->> 'pi')::int into my_pi from public.game_saves g where g.owner_id = me and g.best_car ? 'pi';
  if my_pi is null then raise exception 'no saved car' using errcode = 'no_data_found'; end if;
  -- An attack started and never finished counts as a lost one, so a bad run can't be dropped and raced again.
  select * into old from public.war_runs where owner_id = me for update;
  if old.owner_id is not null then
    if old.started_at > now() - interval '3 seconds' then raise exception 'slow down' using errcode = 'check_violation'; end if;
    insert into public.war_attacks (battle_id, attacker, attacker_clan, target, won, t, their, stars, points, at)
      values (old.battle_id, me, old.clan_id, old.target, false, old.their, old.their, 0, 0, old.started_at);
    delete from public.war_runs where owner_id = me;
  end if;
  if econ_private.war_attacks_today(me) >= (rules ->> 'attacksPerDay')::int then
    raise exception 'No war races left today' using errcode = 'check_violation';
  end if;
  x := public.crew_battle_of(cid);
  if x.id is null then raise exception 'No crew war this week'; end if;
  if x.bot is not null then
    if p_target !~ '^bot[0-9]+$' then raise exception 'Not in the rival crew'; end if;
    i := substr(p_target, 4)::int;
    if i < 1 or i > jsonb_array_length(x.bot -> 'members') then raise exception 'Not in the rival crew'; end if;
    -- A par for the attacker's own car (1.3x the floor, as ghost pars), tighter for the crew's stronger drivers.
    w := ((x.bot -> 'members' -> (i - 1)) ->> 'w')::numeric;
    their := round(public.race_floor(my_pi) * (1.34 - 0.05 * least(greatest(w, 0.4), 1.6)), 2);
  else
    rival := case when cid = x.a then x.b else x.a end;
    if p_target !~ '^[0-9a-f-]{36}$' or not exists (select 1 from public.clan_members m where m.clan_id = rival and m.owner_id = p_target::uuid) then
      raise exception 'Not in the rival crew';
    end if;
    their := public.ghost_target(p_target::uuid);
    if their is null then raise exception 'They have no car to race yet'; end if;
  end if;
  insert into public.war_runs as r (owner_id, battle_id, clan_id, target, their, started_at)
    values (me, x.id, cid, p_target, their, now())
    on conflict (owner_id) do update set battle_id = excluded.battle_id, clan_id = excluded.clan_id,
      target = excluded.target, their = excluded.their, started_at = now();
  return jsonb_build_object('their', their,
    'left', (rules ->> 'attacksPerDay')::int - econ_private.war_attacks_today(me) - 1);
end $$;

-- Finishes the attack in progress: stars and war points for a win. Counts as one of the day's attacks either way.
create or replace function public.war_attack_submit(t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  rules jsonb := public.crew_war_rules();
  r public.war_runs;
  my_pi int;
  kept numeric;
  won boolean;
  stars int := 0;
  pts int := 0;
begin
  if me is null then raise exception 'Sign in to race in the crew war' using errcode = 'insufficient_privilege'; end if;
  if t is null or t <= 0 or t > 120 then raise exception 'bad time' using errcode = 'check_violation'; end if;
  select * into r from public.war_runs where owner_id = me for update;
  if r.owner_id is null or now() - r.started_at < make_interval(secs => t::double precision) or now() - r.started_at > interval '3 minutes' then
    raise exception 'no run to finish' using errcode = 'check_violation';
  end if;
  delete from public.war_runs where owner_id = me;
  select (g.best_car ->> 'pi')::int into my_pi from public.game_saves g where g.owner_id = me;
  kept := round(greatest(t, public.race_floor(coalesce(my_pi, 0))), 3);
  won := kept < r.their;
  if won then
    stars := 1
      + case when kept <= r.their * (1 - (rules ->> 'star2')::numeric) then 1 else 0 end
      + case when kept <= r.their * (1 - (rules ->> 'star3')::numeric) then 1 else 0 end;
    pts := stars * (rules ->> 'starPoints')::int;
  end if;
  insert into public.war_attacks (battle_id, attacker, attacker_clan, target, won, t, their, stars, points)
    values (r.battle_id, me, r.clan_id, r.target, won, kept, r.their, stars, pts);
  -- Points go to the crew the attack started for, while that crew still has this player.
  if pts > 0 and exists (select 1 from public.clan_members m where m.owner_id = me and m.clan_id = r.clan_id) then
    perform econ_private.battle_add(me, r.clan_id, 0, 0, 0, 0, pts);
  end if;
  return jsonb_build_object('kept', kept, 'their', r.their, 'won', won, 'stars', stars, 'points', pts,
    'left', greatest(0, (rules ->> 'attacksPerDay')::int - econ_private.war_attacks_today(me)));
end $$;

-- 0050's battle_side, plus "roster" for a real crew: every member with their ghost's car and time, for the map.
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
                    'points', floor(score * (m ->> 'w')::numeric / wsum)::int, 'w', (m ->> 'w')::numeric) order by (m ->> 'w')::numeric desc)
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
      where p.clan_id = p_clan and p.week_start = x.week_start and p_clan is not null), '[]'),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.owner_id, 'name', coalesce(g.town_name, ''),
        'car', g.best_car ->> 'name', 'body', g.best_car ->> 'body', 'color', g.best_car ->> 'color',
        'pi', (g.best_car ->> 'pi')::int, 't', public.ghost_target(m.owner_id)) order by m.joined_at)
      from public.clan_members m left join public.game_saves g on g.owner_id = m.owner_id
      where m.clan_id = p_clan and p_clan is not null), '[]'));
end $$;

-- 0113's battle_view, plus this war's attacks from this crew's side (newest first, up to 60).
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
    'par', econ_private.battle_par(p_clan, x.week_start),
    'us', econ_private.battle_side(x, p_clan, false),
    'them', econ_private.battle_side(x, rival, x.bot is not null),
    'claimed', (select coalesce(jsonb_agg(kind), '[]') from public.crew_chests
                where owner_id = p_me and week_start between x.week_start + 1 and x.week_start + 4
                  and kind in ('battle', 'mvp', 'tier1', 'tier2')),
    'attacks', coalesce((select jsonb_agg(jsonb_build_object(
        'side', case when a.attacker_clan = p_clan then 'us' else 'them' end,
        'by', a.attacker, 'byName', coalesce(g.town_name, ''), 'target', a.target,
        'won', a.won, 'stars', a.stars, 'points', a.points, 'at', a.at) order by a.at desc)
      from (select * from public.war_attacks where battle_id = x.id order by at desc limit 60) a
      left join public.game_saves g on g.owner_id = a.attacker), '[]'));
end $$;

-- 0113's crew_battle(), plus "attacksLeft" today and the war map rules.
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
  wars jsonb := '[]';
  rival uuid;
  c public.clans;
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
    for r in select * from public.crew_battles where cid in (a, b) and week_start < wk order by week_start desc limit 52 loop
      res := public.crew_battle_result(r.id, cid);
      if res = 'win' then w := w + 1; elsif res = 'loss' then l := l + 1; else d := d + 1; end if;
      if counting and res = 'win' then streak := streak + 1; else counting := false; end if;
      -- The war log: the last eight wars, with the rival's badge and both scores.
      if jsonb_array_length(wars) < 8 then
        rival := case when cid = r.a then r.b else r.a end;
        c := null;
        if r.bot is null then select * into c from public.clans where id = rival; end if;
        wars := wars || jsonb_build_array(jsonb_build_object(
          'week', r.week_start, 'venue', r.venue, 'result', res,
          'us', public.crew_battle_score(r.id, cid),
          'them', public.crew_battle_rival_score(r.id, cid),
          'rival', case when r.bot is not null
            then jsonb_build_object('bot', true, 'name', r.bot ->> 'name', 'tag', r.bot ->> 'tag', 'emblem', r.bot ->> 'emblem', 'color', r.bot ->> 'color')
            else jsonb_build_object('bot', false, 'id', rival, 'name', coalesce(c.name, ''), 'tag', coalesce(c.tag, ''),
              'emblem', coalesce(c.emblem, '🏁'), 'color', coalesce(c.color, '#546e7a')) end));
      end if;
    end loop;
  end if;
  return jsonb_build_object(
    'rules', public.crew_battle_rules() || public.crew_war_rules(),
    'now', now(),
    'payable', public.crew_chest_payable(),
    'chests', (select count(*) from public.crew_chests where owner_id = me),
    'record', jsonb_build_object('wins', w, 'losses', l, 'draws', d, 'streak', streak),
    'log', wars,
    'attacksLeft', greatest(0, (public.crew_war_rules() ->> 'attacksPerDay')::int - econ_private.war_attacks_today(me)),
    'current', case when cur.id is null then null else econ_private.battle_view(cur, cid, me) end,
    'last', case when prev.id is null then null else econ_private.battle_view(prev, prev_clan, me) end);
end $$;

revoke execute on function econ_private.war_attacks_today(uuid), econ_private.battle_side(public.crew_battles, uuid, boolean),
  econ_private.battle_view(public.crew_battles, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.war_attack_start(text), public.war_attack_submit(numeric), public.crew_battle() from public, anon;
grant execute on function public.war_attack_start(text), public.war_attack_submit(numeric), public.crew_battle() to authenticated;
grant execute on function public.crew_war_rules() to anon, authenticated;
