-- Helping a friend's businesses while visiting their town (src/lib/help.ts, src/ui/HelpBadges.tsx),
-- like Car Town Streets: tap a shop in their town to lend a hand and you're paid a little for it.
--   * town_help() pays one help: at most perTown (5) different businesses per town and
--     perDay (40) helps in all per UTC day. Neighbour towns (demo-*) count like real ones.
--   * The prize is fixed here from the helper's saved level and the business's saved upgrade
--     level (helpPrize() in src/game/help.ts). The last help in a town adds a few parts.
--   * Each help is paid as a numbered town_visits claim (kind 'help'), so the save guard pays it
--     through `visits` and econ_private.visit_pay() like a visitor's prize: no guard change.
--   * The first help of the day in a real player's town leaves them friend_help()'s note (+fuel).
--   * visitor_next() is replaced only so helps don't count toward the visitor gap or daily cap.
-- Players never write either table themselves. Safe to run before the game update: nothing calls it yet.

do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.town_visits'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%' loop
    execute format('alter table public.town_visits drop constraint %I', c);
  end loop;
end $$;
alter table public.town_visits add constraint town_visits_kind_check check (kind in ('racer', 'tourist', 'mystery', 'barn', 'help'));

create table if not exists public.town_helps (
  id bigint generated always as identity primary key,
  helper uuid not null references auth.users (id) on delete cascade,
  -- The town's owner: a player's id, or a neighbour town's id (demo-rusty...).
  owner text not null,
  building text not null,
  day date not null default ((now() at time zone 'utc')::date),
  visit_id bigint references public.town_visits (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (helper, owner, building, day)
);
create index if not exists town_helps_day on public.town_helps (helper, day);
alter table public.town_helps enable row level security;
revoke all on public.town_helps from anon, authenticated;

-- Help one business in a town you're visiting. Returns the prize and its claim number (seq), or
-- raises: 'sign in', 'no save', 'not a business', 'already helped', 'town done', 'day done'.
create or replace function public.town_help(p_owner text, p_building text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
  -- helps:begin
  t jsonb := $helps${"perTown":5,"perDay":40,"coins":20,"coinsPerLevel":5,"coinsPerShopLevel":10,"xp":2,"xpPerFiveLevels":1,"lastParts":2}$helps$::jsonb;
  -- helps:end
  lvl int;
  st jsonb;
  b jsonb;
  shop int := 1;
  done int;
  nth int;
  n int;
  pay_coins int;
  pay_xp int;
  pay_parts int;
  vid bigint;
  real_owner uuid;
begin
  if me is null then
    raise exception 'sign in' using errcode = 'insufficient_privilege';
  end if;
  if p_owner is null or p_building is null or p_owner = me::text then
    raise exception 'not a business' using errcode = 'P0001';
  end if;
  -- Same lock as visitor_claim(): both number claims in town_visits.
  perform pg_advisory_xact_lock(hashtext('visitors:' || me::text));
  select g.level into lvl from public.game_saves g where g.owner_id = me;
  if lvl is null then
    raise exception 'no save' using errcode = 'P0001';
  end if;
  if p_owner ~ '^demo-(rusty|gear|nitro)$' then
    -- Neighbour towns are built on the client from a seed: every business there is level 1.
    if p_building !~ ('^' || p_owner || '-[0-9]+-[0-9]+$') then
      raise exception 'not a business' using errcode = 'P0001';
    end if;
  elsif p_owner ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    real_owner := p_owner::uuid;
    select g.state into st from public.game_saves g where g.owner_id = real_owner;
    if jsonb_typeof(st -> 'buildings') = 'array' then
      select x into b from jsonb_array_elements(st -> 'buildings') x where x ->> 'uid' = p_building limit 1;
    end if;
    -- Only businesses with a job (the catalog lists their earnings per level).
    if b is null or coalesce((public.econ_catalog() -> 'buildings' -> (b ->> 'def') -> 'up' -> 'coins' ->> 0)::numeric, 0) <= 0 then
      raise exception 'not a business' using errcode = 'P0001';
    end if;
    shop := least(greatest(coalesce(floor(public.econ_num(b, 'level'))::int, 1), 1), 10);
  else
    raise exception 'not a business' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.town_helps h where h.helper = me and h.owner = p_owner and h.building = p_building and h.day = d) then
    raise exception 'already helped' using errcode = 'P0001';
  end if;
  select count(*) into done from public.town_helps h where h.helper = me and h.owner = p_owner and h.day = d;
  if done >= (t ->> 'perTown')::int then
    raise exception 'town done' using errcode = 'P0001';
  end if;
  if (select count(*) from public.town_helps h where h.helper = me and h.day = d) >= (t ->> 'perDay')::int then
    raise exception 'day done' using errcode = 'P0001';
  end if;
  nth := done + 1;
  pay_coins := (t ->> 'coins')::int + (t ->> 'coinsPerLevel')::int * lvl + (t ->> 'coinsPerShopLevel')::int * (shop - 1);
  pay_xp := (t ->> 'xp')::int + (t ->> 'xpPerFiveLevels')::int * (lvl / 5);
  pay_parts := case when nth = (t ->> 'perTown')::int then (t ->> 'lastParts')::int else 0 end;
  select coalesce(max(x.seq), 0) + 1 into n from public.town_visits x where x.owner_id = me;
  insert into public.town_visits (owner_id, kind, coins, xp, parts, bucks, expires_at, claimed_at, seq)
  values (me, 'help', pay_coins, pay_xp, pay_parts, 0, now(), now(), n)
  returning id into vid;
  insert into public.town_helps (helper, owner, building, day, visit_id) values (me, p_owner, p_building, d, vid);
  -- They hear about it once a day (friend_gifts.sql applies its own limits).
  if real_owner is not null and nth = 1 then
    perform public.friend_help(real_owner);
  end if;
  return jsonb_build_object('coins', pay_coins, 'xp', pay_xp, 'parts', pay_parts, 'bucks', 0, 'seq', n, 'nth', nth,
    'left', (t ->> 'perTown')::int - nth);
end $$;

-- The businesses you've helped today in one town.
create or replace function public.town_helps_today(p_owner text) returns setof text
language sql stable security definer set search_path = '' as $$
  select h.building from public.town_helps h
  where h.helper = auth.uid() and h.owner = p_owner and h.day = (now() at time zone 'utc')::date;
$$;

create or replace function public.visitor_next(p_barn boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- visitors:begin
  t jsonb := $visitors${"kinds":{"racer":{"weight":30,"minutes":5,"coins":60,"coinsPerLevel":15,"xp":0,"xpPerLevel":0,"parts":3,"bucksChance":0.05},"tourist":{"weight":40,"minutes":5,"coins":30,"coinsPerLevel":6,"xp":3,"xpPerLevel":1,"parts":0,"bucksChance":0},"mystery":{"weight":25,"minutes":0.5,"coins":60,"coinsPerLevel":12,"xp":10,"xpPerLevel":2,"parts":2,"bucksChance":0.1},"barn":{"weight":5,"minutes":10,"coins":0,"coinsPerLevel":0,"xp":0,"xpPerLevel":0,"parts":0,"bucksChance":0}},"gap":4,"perDay":30,"barn":{"common":70,"scarce":25,"rare":5},"barnPerDay":1}$visitors$::jsonb;
  -- visitors:end
  cur public.town_visits;
  last_at timestamptz;
  today_n int;
  lvl int;
  st jsonb;
  rusty boolean;
  total numeric := 0;
  r numeric;
  k text;
  pick text;
  p jsonb;
begin
  if me is null then
    raise exception 'sign in for visitors' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('visitors:' || me::text));
  select * into cur from public.town_visits v
    where v.owner_id = me and v.kind <> 'help' and v.claimed_at is null and v.expires_at > now()
    order by v.created_at desc limit 1;
  if cur.id is not null then
    return econ_private.visit_json(cur);
  end if;
  select max(v.created_at) into last_at from public.town_visits v where v.owner_id = me and v.kind <> 'help';
  if last_at > now() - make_interval(mins => (t ->> 'gap')::int) then
    return jsonb_build_object('wait', ceil(extract(epoch from last_at + make_interval(mins => (t ->> 'gap')::int) - now())));
  end if;
  select count(*) into today_n from public.town_visits v
    where v.owner_id = me and v.kind <> 'help' and v.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if today_n >= (t ->> 'perDay')::int then
    return jsonb_build_object('wait', ceil(extract(epoch from date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '1 day' - now())));
  end if;
  select g.level, g.state into lvl, st from public.game_saves g where g.owner_id = me;
  if lvl is null then
    return jsonb_build_object('wait', 60);
  end if;
  rusty := coalesce(p_barn, false) and jsonb_typeof(st -> 'buildings') = 'array'
    and exists (select 1 from jsonb_array_elements(st -> 'buildings') b where b ->> 'def' = 'rescue')
    and (select count(*) from public.town_visits v where v.owner_id = me and v.kind = 'barn'
         and v.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') < (t ->> 'barnPerDay')::int;
  for k, p in select e.key, e.value from jsonb_each(t -> 'kinds') e loop
    if k <> 'barn' or rusty then total := total + (p ->> 'weight')::numeric; end if;
  end loop;
  r := random() * total;
  for k, p in select e.key, e.value from jsonb_each(t -> 'kinds') e loop
    continue when k = 'barn' and not rusty;
    pick := k;
    r := r - (p ->> 'weight')::numeric;
    exit when r <= 0;
  end loop;
  p := t -> 'kinds' -> pick;
  insert into public.town_visits (owner_id, kind, coins, xp, parts, bucks, expires_at)
  values (me, pick,
    round((p ->> 'coins')::numeric + (p ->> 'coinsPerLevel')::numeric * lvl),
    round((p ->> 'xp')::numeric + (p ->> 'xpPerLevel')::numeric * lvl),
    (p ->> 'parts')::int,
    case when random() < (p ->> 'bucksChance')::numeric then 1 else 0 end,
    now() + make_interval(secs => (p ->> 'minutes')::numeric * 60))
  returning * into cur;
  return econ_private.visit_json(cur);
end $$;

revoke execute on function public.town_help(text, text), public.town_helps_today(text), public.visitor_next(boolean) from public, anon;
grant execute on function public.town_help(text, text), public.town_helps_today(text), public.visitor_next(boolean) to authenticated;
