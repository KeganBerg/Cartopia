-- 0064 Daily prize wheel (2026-10-12, thread "Daily prize wheel", PR #372): one free spin a UTC day, in place of
-- the daily log-in bonus. Slices and odds come from WHEEL in src/game/wheel.ts (wheel.test.ts
-- keeps the table below in step).
--   * wheel_spin() rolls a signed-in player's spin and keeps it in public.crate_opens as an open
--     of crate 'wheel' costing nothing, numbered after their crate opens. The save guard already
--     pays crate opens through econ_private.crate_pay(), so it needs no change:
--       coins slices are kind 'coins' (a share of a Street Crate's price at the player's level);
--       gems slices are kind 'coins' (jackpot: kind 'jackpot') with coins 0 and a NEGATIVE
--         cost_bucks, which the guard's `max_bucks ... - cr_bucks` turns into gems won;
--       a part is kind 'mod' (the Garage Crate's parts, the Street's when none fit);
--       a skin is kind 'skin' / 'skindupe' (the Garage Crate's tiers).
--     Parts and skins read the current crate tables out of crate_open() itself, so new cars,
--     parts and skins reach the wheel whenever the crates are regenerated.
--   * Opens the save hasn't counted yet go back first ({"pending": [...]}), as crate_open() does.
--   * One spin per UTC day: a second one raises 'spun today'.
-- Returns {"slice": <slice id>, "day": "YYYY-MM-DD", "open": <crate_json>}.
-- Run BEFORE the game update that shows the wheel ships (the client needs the RPC).
--
-- Economy review: a negative cost_bucks is only ever written here (crate_open() charges >= 0), and
-- the guard adds it back as gems through max_bucks; crate_pay() and car_granted() are the only other
-- readers and neither treats cost_bucks as spend. A reset (0063) deletes crate_opens, so a reset
-- player can spin again the same day, on a town that has just lost everything: not worth a table.
-- Any future replacement of crate_open() must keep its dollar-quoted crates table (the regen
-- scripts do); without it the wheel refuses to spin instead of paying from a missing table.

create or replace function public.wheel_spin() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- wheel:begin
  w jsonb := $wheel${"slices":[{"id":"coins-s","kind":"coins","weight":31,"mult":0.3},{"id":"part","kind":"part","weight":14},{"id":"coins-m","kind":"coins","weight":22,"mult":0.7},{"id":"gems-1","kind":"gems","weight":12,"gems":1},{"id":"coins-l","kind":"coins","weight":9,"mult":2},{"id":"skin","kind":"skin","weight":4},{"id":"gems-3","kind":"gems","weight":7,"gems":3},{"id":"jackpot","kind":"jackpot","weight":1,"gems":15}],"fallback":"coins-m","dupe":"coins-l"}$wheel$::jsonb;
  -- wheel:end
  t jsonb;
  st jsonb;
  lvl int;
  saved int;
  last_seq int;
  pend jsonb;
  day date := (now() at time zone 'utc')::date;
  price numeric;
  sl jsonb;
  total numeric;
  r numeric;
  cc text;
  car jsonb;
  cdef jsonb;
  have jsonb;
  mods jsonb;
  choices jsonb := '[]';
  pick jsonb;
  pool jsonb;
  owned boolean;
  o public.crate_opens;
begin
  if me is null then
    raise exception 'sign in to spin' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('crate:' || me::text));
  select g.state, g.level into st, lvl from public.game_saves g where g.owner_id = me;
  if jsonb_typeof(st) is distinct from 'object' then
    raise exception 'no saved town yet' using errcode = 'P0001';
  end if;
  lvl := greatest(coalesce(lvl, 1), 1);
  select coalesce(max(x.seq), 0) into last_seq from public.crate_opens x where x.owner_id = me;
  saved := floor(public.econ_num(st, 'crates'))::int;
  if saved < last_seq then
    select coalesce(jsonb_agg(econ_private.crate_json(x) order by x.seq), '[]') into pend
      from public.crate_opens x where x.owner_id = me and x.seq > saved;
    return jsonb_build_object('pending', pend);
  end if;
  if exists (select 1 from public.crate_opens x where x.owner_id = me and x.crate = 'wheel'
             and (x.created_at at time zone 'utc')::date = day) then
    raise exception 'spun today' using errcode = 'P0001';
  end if;

  -- The crate tables, straight from crate_open() (its dollar-quoted crates table).
  t := substring(pg_get_functiondef('public.crate_open(text)'::regprocedure) from '\$crates\$(.*?)\$crates\$')::jsonb;
  if jsonb_typeof(t -> 'crates' -> 'street') is distinct from 'object' then
    raise exception 'wheel is off' using errcode = 'P0001'; -- crate_open() lost its crates table
  end if;
  price := (t -> 'crates' -> 'street' ->> 'base')::numeric + (t -> 'crates' -> 'street' ->> 'perLevel')::numeric * lvl;

  -- Which slice.
  select sum((x ->> 'weight')::numeric) into total from jsonb_array_elements(w -> 'slices') x;
  r := random()::numeric * total;
  for sl in select x from jsonb_array_elements(w -> 'slices') x loop
    r := r - (sl ->> 'weight')::numeric;
    exit when r <= 0;
  end loop;

  -- A part: for one of the player's cars, a Garage Crate part (Street when none fit) that's
  -- unlocked and not owned yet. None at all pays the fallback coins.
  if sl ->> 'kind' = 'part' then
    cc := 'garage';
    loop
      for car in select x from jsonb_array_elements(case when jsonb_typeof(st -> 'cars') = 'array' then st -> 'cars' else '[]' end) x
                 where jsonb_typeof(x) = 'object' and coalesce(x ->> 'uid', '') <> '' loop
        cdef := t -> 'cars' -> (car ->> 'model');
        continue when cdef is null;
        have := (case when jsonb_typeof(car -> 'ownedMods') = 'array' then car -> 'ownedMods' else '[]' end)
             || (case when jsonb_typeof(car -> 'mods') = 'array' then car -> 'mods' else '[]' end);
        select coalesce(jsonb_agg(e.key order by e.key), '[]') into mods from jsonb_each(t -> 'mods') e
          where e.value ->> 'crate' = cc
            and (e.value ->> 'unlock')::int <= lvl
            and case when e.value ? 'only' then (e.value -> 'only') ? (cdef ->> 'body') else not coalesce((e.value -> 'notOn') ? (cdef ->> 'body'), false) end
            and not have ? e.key;
        if jsonb_array_length(mods) > 0 then
          choices := choices || jsonb_build_array(jsonb_build_object('car', car ->> 'uid', 'mods', mods));
        end if;
      end loop;
      exit when jsonb_array_length(choices) > 0 or jsonb_typeof(t -> 'crates' -> cc -> 'below') is distinct from 'string';
      cc := t -> 'crates' -> cc ->> 'below';
    end loop;
    if jsonb_array_length(choices) > 0 then
      pick := choices -> floor(random()::numeric * jsonb_array_length(choices))::int;
      insert into public.crate_opens (owner_id, seq, crate, kind, car_uid, mod)
        values (me, last_seq + 1, 'wheel', 'mod', pick ->> 'car', (pick -> 'mods') ->> floor(random()::numeric * jsonb_array_length(pick -> 'mods'))::int)
        returning * into o;
      return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
    end if;
    select x into sl from jsonb_array_elements(w -> 'slices') x where x ->> 'id' = w ->> 'fallback';
  end if;

  -- A skin: a Garage Crate tier skin, rarer tiers less likely. One the player has pays the dupe coins.
  if sl ->> 'kind' = 'skin' then
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'part', e.part, 'tier', e.value ->> 'tier', 'level', e.value -> 'level', 'set', e.value -> 'set') order by e.part, e.key), '[]')
      into pool from (select false as part, x.key, x.value from jsonb_each(t -> 'skins') x
                      union all select true, y.key, y.value from jsonb_each(t -> 'modSkins') y) e
      where (t -> 'crates' -> 'garage' -> 'skins') ? (e.value ->> 'tier');
    if jsonb_array_length(pool) > 0 then
      select sum((t -> 'skinWeight' ->> (x ->> 'tier'))::numeric) into total from jsonb_array_elements(pool) x;
      r := random()::numeric * total;
      for pick in select x from jsonb_array_elements(pool) x loop
        r := r - (t -> 'skinWeight' ->> (pick ->> 'tier'))::numeric;
        exit when r <= 0;
      end loop;
      have := case when (pick ->> 'part')::boolean then st -> 'modSkins' else st -> 'skins' end;
      owned := (jsonb_typeof(have) = 'array' and have ? (pick ->> 'id'))
        or (jsonb_typeof(pick -> 'level') = 'number' and lvl >= (pick ->> 'level')::int)
        or (jsonb_typeof(pick -> 'set') = 'string' and jsonb_typeof(st -> 'claimedSets') = 'array' and (st -> 'claimedSets') ? (pick ->> 'set'));
      insert into public.crate_opens (owner_id, seq, crate, kind, coins, skin, part)
        values (me, last_seq + 1, 'wheel', case when owned then 'skindupe' else 'skin' end,
          case when owned then econ_private.crate_round(price * (select (x ->> 'mult')::numeric from jsonb_array_elements(w -> 'slices') x where x ->> 'id' = w ->> 'dupe')) else 0 end,
          pick ->> 'id', (pick ->> 'part')::boolean)
        returning * into o;
      return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
    end if;
    select x into sl from jsonb_array_elements(w -> 'slices') x where x ->> 'id' = w ->> 'fallback';
  end if;

  -- Gems (and the jackpot): no coins, a negative gem cost.
  if sl ->> 'kind' in ('gems', 'jackpot') then
    insert into public.crate_opens (owner_id, seq, crate, cost_bucks, kind, coins)
      values (me, last_seq + 1, 'wheel', -(sl ->> 'gems')::int, case when sl ->> 'kind' = 'jackpot' then 'jackpot' else 'coins' end, 0)
      returning * into o;
    return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
  end if;

  -- Coins: a share of a Street Crate's price.
  insert into public.crate_opens (owner_id, seq, crate, kind, coins)
    values (me, last_seq + 1, 'wheel', 'coins', econ_private.crate_round(price * (sl ->> 'mult')::numeric))
    returning * into o;
  return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
end $$;

revoke execute on function public.wheel_spin() from public, anon;
grant execute on function public.wheel_spin() to authenticated;
