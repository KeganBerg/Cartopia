-- Surprise visitors in town (src/lib/visitors.ts, src/ui/Visitors.tsx). Every few minutes someone
-- turns up: a street racer to beat, a tourist who tips, a mystery car to tap before it drives off,
-- or a tip for Rusty about a barn find.
--   * visitor_next() decides who comes and fixes the prize from the saved level. One visitor at a
--     time, at most one every VISIT_GAP_MIN minutes and VISITS_PER_DAY a UTC day (data.ts).
--   * visitor_claim() pays a visitor once, before it leaves, and numbers each claim (seq 1, 2, 3...).
--     A barn find is a car Rusty found: it goes into econ_private.rescue_finds like a search's, so
--     the save guard takes it into storage (0022), at no search cost.
--   * econ_private.visit_pay(from, to) totals the prizes of claims from+1..to, for the save guard:
--     the save's `visits` counts the claims it has added (the guard change ships with Cheat-proof economy).
-- Players never write town_visits themselves. Safe to run before the game update: nothing calls it yet.

create table if not exists public.town_visits (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('racer', 'tourist', 'mystery', 'barn')),
  coins int not null default 0,
  xp int not null default 0,
  parts int not null default 0,
  bucks int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  seq int,
  unique (owner_id, seq)
);
create index if not exists town_visits_owner on public.town_visits (owner_id, created_at desc);
alter table public.town_visits enable row level security;
revoke all on public.town_visits from anon, authenticated;

-- What the client needs to show a visitor.
create or replace function econ_private.visit_json(v public.town_visits) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', v.id, 'kind', v.kind, 'coins', v.coins, 'xp', v.xp, 'parts', v.parts, 'bucks', v.bucks,
    'expires_in', greatest(extract(epoch from v.expires_at - now()), 0))
$$;
revoke all on function econ_private.visit_json(public.town_visits) from public, anon, authenticated;

-- The visitor in town now, or a new one if it's time. p_barn: the player has room in storage
-- (a barn tip also needs Rusty's Rescue in the saved town). Returns the visitor, or {"wait": seconds}.
create or replace function public.visitor_next(p_barn boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- visitors:begin
  t jsonb := $visitors${"kinds":{"racer":{"weight":30,"minutes":5,"coins":100,"coinsPerLevel":25,"xp":0,"xpPerLevel":0,"parts":3,"bucksChance":0.05},"tourist":{"weight":35,"minutes":5,"coins":50,"coinsPerLevel":10,"xp":5,"xpPerLevel":1,"parts":0,"bucksChance":0},"mystery":{"weight":25,"minutes":0.5,"coins":100,"coinsPerLevel":20,"xp":10,"xpPerLevel":2,"parts":2,"bucksChance":0.1},"barn":{"weight":10,"minutes":10,"coins":0,"coinsPerLevel":0,"xp":0,"xpPerLevel":0,"parts":0,"bucksChance":0}},"gap":4,"perDay":30,"barn":{"common":30,"scarce":50,"rare":20}}$visitors$::jsonb;
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
    where v.owner_id = me and v.claimed_at is null and v.expires_at > now()
    order by v.created_at desc limit 1;
  if cur.id is not null then
    return econ_private.visit_json(cur);
  end if;
  select max(v.created_at) into last_at from public.town_visits v where v.owner_id = me;
  if last_at > now() - make_interval(mins => (t ->> 'gap')::int) then
    return jsonb_build_object('wait', ceil(extract(epoch from last_at + make_interval(mins => (t ->> 'gap')::int) - now())));
  end if;
  select count(*) into today_n from public.town_visits v
    where v.owner_id = me and v.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if today_n >= (t ->> 'perDay')::int then
    return jsonb_build_object('wait', ceil(extract(epoch from date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '1 day' - now())));
  end if;
  select g.level, g.state into lvl, st from public.game_saves g where g.owner_id = me;
  if lvl is null then
    return jsonb_build_object('wait', 60);
  end if;
  rusty := coalesce(p_barn, false) and jsonb_typeof(st -> 'buildings') = 'array'
    and exists (select 1 from jsonb_array_elements(st -> 'buildings') b where b ->> 'def' = 'rescue');
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

-- Collect a visitor's prize. Returns the prize, its claim number (seq) and, for a barn find, the car.
create or replace function public.visitor_claim(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- barnspots:begin
  spots jsonb := $barnspots${"suburbs":{"unlock":1,"cars":[["pip","common"],["civic","common"],["bug","common"],["woodie","scarce"],["trail","scarce"],["miata","rare"]]},"farm":{"unlock":3,"cars":[["bug","common"],["trail","common"],["hauler","common"],["woodie","scarce"],["buggy","scarce"],["stallion","rare"]]},"downtown":{"unlock":5,"cars":[["civic","common"],["cruiser","common"],["rally","scarce"],["bandit","scarce"],["stallion","scarce"],["vette","rare"]]},"desert":{"unlock":7,"cars":[["buggy","common"],["hauler","common"],["bandit","scarce"],["charger","scarce"],["lemans","rare"],["gtr","rare"],["speedster","rare"]]},"track":{"unlock":10,"cars":[["rally","common"],["vette","common"],["charger","scarce"],["lemans","scarce"],["gullwing","rare"],["hyper","rare"]]}}$barnspots$::jsonb;
  -- barnspots:end
  -- visitors:begin
  t jsonb := $visitors${"kinds":{"racer":{"weight":30,"minutes":5,"coins":100,"coinsPerLevel":25,"xp":0,"xpPerLevel":0,"parts":3,"bucksChance":0.05},"tourist":{"weight":35,"minutes":5,"coins":50,"coinsPerLevel":10,"xp":5,"xpPerLevel":1,"parts":0,"bucksChance":0},"mystery":{"weight":25,"minutes":0.5,"coins":100,"coinsPerLevel":20,"xp":10,"xpPerLevel":2,"parts":2,"bucksChance":0.1},"barn":{"weight":10,"minutes":10,"coins":0,"coinsPerLevel":0,"xp":0,"xpPerLevel":0,"parts":0,"bucksChance":0}},"gap":4,"perDay":30,"barn":{"common":30,"scarce":50,"rare":20}}$visitors$::jsonb;
  -- visitors:end
  v public.town_visits;
  n int;
  lvl int;
  total numeric;
  r numeric;
  c jsonb;
  u text;
  car jsonb;
begin
  if me is null then
    raise exception 'sign in for visitors' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('visitors:' || me::text));
  select * into v from public.town_visits x where x.id = p_id and x.owner_id = me for update;
  if v.id is null or v.claimed_at is not null then
    raise exception 'no such visitor' using errcode = 'P0001';
  end if;
  -- A little grace for the trip to the server; a street race takes a while to run.
  if now() > v.expires_at + interval '15 seconds' then
    raise exception 'the visitor left' using errcode = 'P0001';
  end if;
  if v.kind = 'racer' and now() < v.created_at + interval '10 seconds' then
    raise exception 'race first' using errcode = 'P0001';
  end if;
  select coalesce(max(x.seq), 0) + 1 into n from public.town_visits x where x.owner_id = me;
  update public.town_visits set claimed_at = now(), seq = n where id = v.id;
  if v.kind = 'barn' then
    select g.level into lvl from public.game_saves g where g.owner_id = me;
    select sum((t -> 'barn' ->> (x ->> 1))::numeric) into total
      from jsonb_each(spots) s, jsonb_array_elements(s.value -> 'cars') x
      where (s.value ->> 'unlock')::int <= coalesce(lvl, 1);
    r := random() * total;
    for c in select x from jsonb_each(spots) s, jsonb_array_elements(s.value -> 'cars') x
             where (s.value ->> 'unlock')::int <= coalesce(lvl, 1) loop
      r := r - (t -> 'barn' ->> (c ->> 1))::numeric;
      exit when r <= 0;
    end loop;
    u := 'r' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14);
    insert into econ_private.rescue_finds (uid, owner_id, spot, model, rarity, cost) values (u, me, 'barn', c ->> 0, c ->> 1, 0);
    car := jsonb_build_object('uid', u, 'model', c ->> 0, 'rarity', c ->> 1);
  end if;
  return jsonb_build_object('kind', v.kind, 'coins', v.coins, 'xp', v.xp, 'parts', v.parts, 'bucks', v.bucks, 'seq', n, 'car', car);
end $$;

-- For the save guard: the prizes of the caller's claims numbered from+1..to, and how many claims
-- there are in all (n).
create or replace function econ_private.visit_pay(p_from int, p_to int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'n', coalesce((select max(x.seq) from public.town_visits x where x.owner_id = auth.uid()), 0),
    'coins', coalesce(sum(v.coins), 0), 'xp', coalesce(sum(v.xp), 0), 'parts', coalesce(sum(v.parts), 0), 'bucks', coalesce(sum(v.bucks), 0))
  from public.town_visits v
  where v.owner_id = auth.uid() and v.seq > p_from and v.seq <= p_to
$$;

revoke execute on function public.visitor_next(boolean), public.visitor_claim(bigint), econ_private.visit_pay(int, int) from public, anon;
grant execute on function public.visitor_next(boolean), public.visitor_claim(bigint), econ_private.visit_pay(int, int) to authenticated;
