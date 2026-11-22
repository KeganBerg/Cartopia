-- 0113 Crew war chests and war log (2026-10-17; Kegan: the crew war "seems to do nothing", build what clan wars
-- in other games have). Thread "Crew members, settings, ranks and Social menu". Needs 0050 (crew battles) and 0027
-- (crew_chests). No econ_guard() or econ_catalog() change: war chests are crew_chests rows, which the save guard
-- already pays one crew chest each, like the victory and MVP chests.
--  1. crew_battle_rules(): 0050's, plus "par" (45 points a member, at least 2 members: the same par the street
--     crews race to) and "tiers" [0.4, 1]: the war chest track.
--  2. War chests: once the crew's war score reaches 40% of par, and again at 100%, every member who has scored
--     at least minPoints (20) for that crew this week claims a war chest (crew_war_tier_claim). Win or lose:
--     it pays for racing, not for the result. Claimable that week and the next. Rows dated week_start + 3 and
--     + 4 (goal chests are the Monday, victory + 1, MVP + 2), so the most a player earns in one war is four
--     chests: two war chests, victory and MVP.
--  3. battle_view(): 0050's, plus "par" and the war chests in "claimed" ('tier1', 'tier2').
--  4. crew_battle(): 0050's, plus "log": the crew's last eight finished wars (rival, both scores, result).
-- Nothing earlier changes meaning, and running this file again changes nothing.

create or replace function public.crew_battle_rules() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"race":1,"win":3,"live":10,"h2h":25,"livePerRival":3,"memberCap":500,"minPoints":20,"bankMax":300,"bankSeconds":3,"botPerMember":45,"botMinMembers":2,"par":45,"tiers":[0.4,1]}'::jsonb
$$;

-- The war score a crew aims for this week: par a member, counting everyone in the crew now and everyone who
-- scored for it this week (so leaving or kicking members mid-war doesn't lower the bar), at least two.
create or replace function econ_private.battle_par(p_clan uuid, p_week date) returns integer
language sql stable security definer set search_path = '' as $$
  select ((public.crew_battle_rules() ->> 'par')::int * greatest(
    (select count(*) from (
      select owner_id from public.clan_members where clan_id = p_clan
      union
      select owner_id from public.battle_points where clan_id = p_clan and week_start = p_week) u),
    (public.crew_battle_rules() ->> 'botMinMembers')::int))::int
$$;

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
                  and kind in ('battle', 'mvp', 'tier1', 'tier2')));
end $$;

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
    'rules', public.crew_battle_rules(),
    'now', now(),
    'payable', public.crew_chest_payable(),
    'chests', (select count(*) from public.crew_chests where owner_id = me),
    'record', jsonb_build_object('wins', w, 'losses', l, 'draws', d, 'streak', streak),
    'log', wars,
    'current', case when cur.id is null then null else econ_private.battle_view(cur, cid, me) end,
    'last', case when prev.id is null then null else econ_private.battle_view(prev, prev_clan, me) end);
end $$;

-- Claims a war chest (tier 1 at 40% of par, tier 2 at par) for this week's war or last week's. Returns the
-- player's crew chest count, which the game pays up to.
create or replace function public.crew_war_tier_claim(p_week date, p_tier int) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  rules jsonb := public.crew_battle_rules();
  wk date := public.this_week();
  v_clan uuid;
  v_points int;
  x public.crew_battles;
  need int;
begin
  if me is null then raise exception 'Sign in to claim war chests'; end if;
  if not public.crew_chest_payable() then raise exception 'War chests open soon'; end if;
  if p_tier is null or p_tier not in (1, 2) then raise exception 'No such war chest'; end if;
  if p_week is null or p_week not in (wk, wk - 7) then raise exception 'That war chest has expired'; end if;
  perform pg_advisory_xact_lock(hashtext('crew_battle_claim:' || me::text));
  -- The crew this player scored most for that week.
  select clan_id, points into v_clan, v_points from public.battle_points where owner_id = me and week_start = p_week order by points desc limit 1;
  if v_clan is null or v_points < (rules ->> 'minPoints')::int then
    raise exception 'Score % war points to earn war chests', (rules ->> 'minPoints');
  end if;
  select * into x from public.crew_battles where week_start = p_week and v_clan in (a, b);
  if x.id is null then raise exception 'No war that week'; end if;
  need := ceil(econ_private.battle_par(v_clan, p_week) * (rules -> 'tiers' ->> (p_tier - 1))::numeric)::int;
  if public.crew_battle_score(x.id, v_clan) < need then
    raise exception 'Your crew needs % war points for this chest', need;
  end if;
  insert into public.crew_chests (owner_id, week_start, clan_id, kind)
    values (me, p_week + 2 + p_tier, v_clan, 'tier' || p_tier) on conflict do nothing;
  return (select count(*)::int from public.crew_chests where owner_id = me);
end $$;

revoke execute on function econ_private.battle_par(uuid, date), econ_private.battle_view(public.crew_battles, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.crew_battle(), public.crew_war_tier_claim(date, int) from public, anon;
grant execute on function public.crew_battle(), public.crew_war_tier_claim(date, int) to authenticated;
grant execute on function public.crew_battle_rules() to anon, authenticated;
