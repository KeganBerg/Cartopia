-- 0100: KBerg skips Rusty's level locks too (needs 0094; pairs with 0099; "Cheat-proof economy").
--
-- 1. rescue_roll() is 0075's (live md5 22c1cc70) with one change: when the caller passes
--    public.is_admin(), every search spot is open (and the daily hot tip can land on any of them).
--    Searches still cost what they cost; nothing else changes.
-- 2. econ_private.econ_progress() is 0075's (live md5 e66493fa) with one change: an admin saving their
--    own town can open restore bay 2 and upgrade the tow truck below the player level each needs.
--    The truck still costs its parts and goes up one level at a time. Every other player is checked
--    exactly as before.
-- RUN ORDER: any time (0094 is live).

create or replace function public.rescue_roll(spot text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- rescue:begin
  spots jsonb := $spots${"suburbs":{"unlock":1,"cars":[["pip","common"],["civic","common"],["bug","common"],["woodie","scarce"],["trail","scarce"],["miata","rare"]]},"farm":{"unlock":4,"cars":[["bug","common"],["trail","common"],["hauler","common"],["woodie","scarce"],["buggy","scarce"],["stallion","rare"]]},"downtown":{"unlock":9,"cars":[["civic","common"],["cruiser","common"],["rally","scarce"],["bandit","scarce"],["stallion","scarce"],["vette","rare"]]},"desert":{"unlock":15,"cars":[["buggy","common"],["bandit","common"],["stallion","scarce"],["charger","scarce"],["lemans","rare"],["gtr","rare"],["speedster","rare"]]},"track":{"unlock":24,"cars":[["vette","common"],["lemans","common"],["charger","scarce"],["gullwing","scarce"],["gtr","rare"],["hyper","rare"]]}}$spots$::jsonb;
  rar jsonb := $rarity${"common":{"weight":60,"minutes":5},"scarce":{"weight":30,"minutes":30},"rare":{"weight":10,"minutes":120}}$rarity$::jsonb;
  roll jsonb := $roll${"pins":8,"car":0.1}$roll$::jsonb;
  -- rescue:end
  -- What a search at each spot costs (RESCUE_SPOTS in src/game/data.ts).
  -- spotcost:begin
  costs jsonb := $spotcost${"suburbs":500,"farm":1500,"downtown":3500,"desert":7000,"track":15000}$spotcost$::jsonb;
  -- spotcost:end
  -- Rusty's add-ons (hotTable(), truckTable() in src/game/guardTables.ts).
  -- rusty:begin
  hot jsonb := $hot${"rare":3}$hot$::jsonb;
  truck jsonb := $truck$[{"pins":8,"parts":0,"level":1},{"pins":9,"parts":25,"level":4},{"pins":10,"parts":60,"level":9},{"pins":11,"parts":120,"level":15}]$truck$::jsonb;
  pz jsonb := $piece${"gap":90,"day":12}$piece$::jsonb;
  -- rusty:end
  last_at timestamptz;
  n_today int;
  st jsonb;
  tl int;
  npins int;
  hot_spot text;
  piece jsonb;
  sp jsonb := spots -> spot;
  lvl int;
  pins int[] := '{}';
  cars jsonb := '[]';
  total numeric;
  r numeric;
  c jsonb;
  u text;
  i int;
begin
  if me is null then
    raise exception 'sign in to search' using errcode = 'insufficient_privilege';
  end if;
  if sp is null then
    raise exception 'no such spot' using errcode = 'invalid_parameter_value';
  end if;
  select g.level, g.state into lvl, st from public.game_saves g where g.owner_id = me;
  -- KBerg (public.is_admin()) searches every spot (0100).
  if public.is_admin() then lvl := 999; end if;
  if coalesce(lvl, 0) < (sp ->> 'unlock')::int then
    raise exception 'spot not open yet' using errcode = 'insufficient_privilege';
  end if;
  -- The tow truck's level (the save's `truck`, which econ_progress() checks) sets the spots per search.
  tl := least(greatest(coalesce(floor(public.econ_num(st, 'truck')), 0), 0), jsonb_array_length(truck) - 1)::int;
  npins := (truck -> tl ->> 'pins')::int;
  -- Rusty's hot tip: one open spot a UTC day, in unlock order (hotSpot() in src/game/data.ts),
  -- where rare cars turn up `hot.rare` times as often.
  select x.key into hot_spot from (
    select k.key, row_number() over (order by (k.value ->> 'unlock')::int) - 1 as n, count(*) over () as cnt
    from jsonb_each(spots) k where (k.value ->> 'unlock')::int <= coalesce(lvl, 0)) x
    where x.n = floor(extract(epoch from now()) / 86400)::bigint % x.cnt;
  perform pg_advisory_xact_lock(hashtext('rescue:' || me::text));
  if exists (select 1 from econ_private.rescue_finds f where f.owner_id = me and f.created_at > now() - interval '10 seconds') then
    raise exception 'Rusty is still out' using errcode = 'P0001';
  end if;
  -- This player's searches here before this one: the latest, and how many today (UTC).
  select max(f.created_at), count(distinct f.created_at) filter (where f.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    into last_at, n_today from econ_private.rescue_finds f where f.owner_id = me and f.spot = rescue_roll.spot;
  for i in 0 .. npins - 1 loop
    if random() < (roll ->> 'car')::numeric then pins := pins || i; end if;
  end loop;
  if cardinality(pins) = 0 then
    pins := array[floor(random() * npins)::int];
  end if;
  select sum((rar -> (x ->> 1) ->> 'weight')::numeric * case when spot = hot_spot and x ->> 1 = 'rare' then (hot ->> 'rare')::numeric else 1 end)
    into total from jsonb_array_elements(sp -> 'cars') x;
  foreach i in array pins loop
    r := random() * total;
    for c in select x from jsonb_array_elements(sp -> 'cars') x loop
      r := r - (rar -> (c ->> 1) ->> 'weight')::numeric * case when spot = hot_spot and c ->> 1 = 'rare' then (hot ->> 'rare')::numeric else 1 end;
      exit when r <= 0;
    end loop;
    u := 'r' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14);
    insert into econ_private.rescue_finds (uid, owner_id, spot, model, rarity, cost)
      values (u, me, spot, c ->> 0, c ->> 1, round(coalesce((costs ->> spot)::numeric, 0) / cardinality(pins)));
    cars := cars || jsonb_build_object('i', i, 'uid', u, 'model', c ->> 0, 'rarity', c ->> 1);
  end loop;
  -- Rusty's top spot can turn up a resto-mod piece (econ_private.resto_piece_roll(), from the
  -- resto-mod migration; skipped until that has run). It comes back as a crate_opens row.
  -- One roll per real search: none if the last search here was under `piece.gap` seconds ago,
  -- and at most `piece.day` a UTC day (counted from Rusty's finds, so quick searches use them up).
  if spot = 'track' and to_regprocedure('econ_private.resto_piece_roll(uuid,text)') is not null
     and coalesce(last_at, '-infinity') < now() - make_interval(secs => (pz ->> 'gap')::int) and n_today < (pz ->> 'day')::int then
    execute 'select econ_private.resto_piece_roll($1, $2)' into piece using me, 'rusty_track';
  end if;
  return jsonb_build_object('cars', cars) || case when piece is not null then jsonb_build_object('piece', piece) else '{}' end;
end $$;

create or replace function econ_private.econ_progress() returns trigger
language plpgsql set search_path = '' as $$
declare
  o jsonb := old.state;
  s jsonb := new.state;
  e jsonb := coalesce(new.econ, '{}');
  bay jsonb; -- the server's record of the car in a restore bay (econ 'bay' and 'bay2')
  -- Rusty's add-ons (truckTable(), bay2Table() in src/game/guardTables.ts).
  -- rusty:begin
  truck jsonb := $truck$[{"pins":8,"parts":0,"level":1},{"pins":9,"parts":25,"level":4},{"pins":10,"parts":60,"level":9},{"pins":11,"parts":120,"level":15}]$truck$::jsonb;
  bay2 jsonb := $bay2${"level":12}$bay2$::jsonb;
  -- rusty:end
  bk text;
  ek text;
  fk text;
  need numeric;
  t_o int;
  t_n int;
  keep boolean := false;
  adm boolean := false;
  fixes jsonb := '{}';
  now_s numeric := extract(epoch from now());
  -- Shortest restore minutes per car (src/game/guardTables.ts, restoreMinutes()).
  -- restore:begin
  rmins jsonb := $restoremin${"pip":5,"civic":5,"bug":5,"woodie":30,"trail":5,"miata":120,"hauler":5,"buggy":5,"stallion":30,"cruiser":5,"rally":30,"bandit":5,"vette":5,"charger":30,"lemans":5,"gtr":120,"speedster":120,"gullwing":30,"hyper":120}$restoremin$::jsonb;
  -- restore:end
  -- Restore minutes for each rarity (guardTables.ts, rarities()).
  rar jsonb := $rarity${"common":{"weight":60,"minutes":5},"scarce":{"weight":30,"minutes":30},"rare":{"weight":10,"minutes":120}}$rarity$::jsonb;
  o_junk text[];
  junk jsonb;
  f record;
  ok boolean;
  -- Each series' last rival PI before any clears, and for each rival PI the lowest car PI that
  -- can beat it (guardTables.ts, gpSeries() and gpBeatTable()).
  -- gp:begin
  gp_last jsonb := $gpseries${"rookie":{"last":37},"street":{"last":55},"pro":{"last":71},"legends":{"last":87}}$gpseries$::jsonb;
  beat jsonb := $gpbeat$[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,3,3,4,5,6,6,7,8,8,9,10,11,11,12,13,13,14,15,15,16,17,18,18,19,20,20,21,22,23,23,24,25,25,26,27,28,28,29,30,30,31,32,33,33,34,35,35,36,37,37,38,39,40,40,41,42,42,43,44,44,45,46,46,47,48,49,49,50,51,51,52,53,54,54,55,56,56,57,58,58,59,60,60,61,62,63,63,64,65,65,66,67,67,68,69,69,70,71,72,72,73,73,74,75,76,76,77,78,78,79,80,80,81,82,82,84,84,85,86,86,87,88,89,89,90,91,91,92,93,93,94,95,95,96,97,98,99,99,100,100,101,102,102,103,104,104,105,106,107,107,108,108,109,110,110,111,112,112,113,114,114,115,116,116,117,118,118,119,119,120,121,121,122,123,123,124,125,125,126,126,127,128,128,129,130,130,131,132,132,133,134,134,135,135,136,137,138,138,139,139,140,141,141,142,143,143,144,144,145,146,146,147,148,148,149,149,150,151,151,152,153,153,154,155,155,156,156,157,158,158,158,159,160,161,161,162,163,163,164,164,165,166,166,167,168,168,169,169,170,171,171,172,173,173,174,174,175,175,176,177,177,178,179,179,180,181,181,181,182,183,184,184,185,185,186,186,187,188,188,189,190,190,191,192,192,193,193,194,194,195,196,196,197,197,198,199,200,200,201,201,202,202,203,203,204,205,205,206,207,207,208,209,209,210,210,211,211,212,213,214,214,215,215,216,216,217,217,218,219,220,220,221,221,222,222,223,224,224,225,225,226,226,228,228,228,229,230,230,231,232,232,232,233,234]$gpbeat$::jsonb;
  -- gp:end
  cat jsonb;
  cars jsonb;
  o_uids text[];
  orr jsonb;
  sr jsonb;
  out_uid text;
  paid numeric;
  left_s numeric;
  done boolean;
  removed boolean := false;
  k text;
  v jsonb;
  oc numeric;
  sc numeric;
  rival int;
  my_pi int;
  prize text;
begin
  if tg_op <> 'UPDATE' or current_user not in ('authenticated', 'anon') or jsonb_typeof(o) is distinct from 'object' then
    return new;
  end if;
  -- KBerg (public.is_admin()) saving their own town skips the level locks below: bay 2 and the
  -- tow truck (0100). is_admin() is only asked for signed-in players (anon can't run it).
  if current_user = 'authenticated' then
    if new.owner_id = auth.uid() and public.is_admin() then adm := true; end if;
  end if;
  cat := public.econ_catalog();
  cars := case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end;
  o_uids := array(select x ->> 'uid' from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) x);
  -- Bucks spent this save, less what new bucks-only parts and cars cost, plus a buck per level gained.
  paid := public.econ_num(o, 'bucks') - public.econ_num(s, 'bucks')
    + greatest(public.econ_num(s, 'level') - public.econ_num(o, 'level'), 0)
    - coalesce((select sum(n.bucks) from public.econ_new_bucks_mods(cars, o, cat) n), 0)
    - coalesce((select sum((cat -> 'cars' -> (x ->> 'model') ->> 'bucks')::numeric) from jsonb_array_elements(cars) x
                where not (x ->> 'uid') = any(o_uids) and cat -> 'cars' ? (x ->> 'model')), 0);

  -- 1. Rusty's storage -----------------------------------------------------------------------
  -- A car new to storage must be one the server rolled for this player (rescue_roll()) and not
  -- yet restored. It keeps the rarity the server gave it.
  o_junk := array(select x ->> 'uid' from jsonb_array_elements(case when jsonb_typeof(o -> 'junkyard') = 'array' then o -> 'junkyard' else '[]' end) x);
  if jsonb_typeof(s -> 'junkyard') = 'array' then
    junk := '[]';
    for v in select x from jsonb_array_elements(s -> 'junkyard') x loop
      if (v ->> 'uid') = any(o_junk) then
        junk := junk || jsonb_build_array(v);
        continue;
      end if;
      select * into f from econ_private.rescue_find(v ->> 'uid');
      if f.model is not null and f.model = v ->> 'model' and not f.bayed then
        junk := junk || jsonb_build_array(v || jsonb_build_object('rarity', f.rarity));
      else
        fixes := fixes || '{"junkyard":"not found by Rusty"}';
      end if;
    end loop;
    s := jsonb_set(s, '{junkyard}', junk);
  end if;

  -- 2. Restore bays --------------------------------------------------------------------------
  -- Bay 1 (`restoring`, econ 'bay') and bay 2 (`restoring2`, econ 'bay2', open from bay2.level)
  -- run the same checks. Bucks paid this save pay for one bay's rush, not both.
  foreach bk in array array['restoring', 'restoring2'] loop
    ek := case bk when 'restoring' then 'bay' else 'bay2' end;
    fk := case bk when 'restoring' then 'restore' else 'restore2' end;
    bay := old.econ -> ek;
    orr := case when jsonb_typeof(o -> bk) = 'object' then o -> bk end;
    sr := case when jsonb_typeof(s -> bk) = 'object' then s -> bk end;
    out_uid := null;
    if bk = 'restoring2' and sr is not null and sr ->> 'uid' is distinct from orr ->> 'uid'
       and ((not adm and public.econ_num(s, 'level') < (bay2 ->> 'level')::numeric) or sr ->> 'uid' is not distinct from s -> 'restoring' ->> 'uid') then
      -- Bay 2 opens at its level, and one car can't be in both bays.
      fixes := fixes || '{"restore2":"bay 2 not open"}';
      s := jsonb_set(s, '{restoring2}', coalesce(orr, 'null'));
      sr := orr;
    end if;
    if bay is null and orr is not null then
      -- In the bay before this check existed: let it finish.
      bay := jsonb_build_object('uid', orr ->> 'uid', 'model', orr ->> 'model', 'at', 0, 'mins', 0, 'rushed', true);
    end if;
    -- The car leaving the bay this save, if any.
    select x ->> 'uid' into out_uid from jsonb_array_elements(cars) x
      where bay is not null and x ->> 'uid' = bay ->> 'uid' and x ->> 'model' = bay ->> 'model' and not (x ->> 'uid') = any(o_uids)
      limit 1;
    if out_uid is not null then
      left_s := (bay ->> 'at')::numeric + (bay ->> 'mins')::numeric * 60 - now_s - 60;
      need := greatest(1, ceil(left_s / 1800));
      done := (bay ->> 'rushed')::boolean or left_s <= 0 or paid >= need;
      if done then
        if not (bay ->> 'rushed')::boolean and left_s > 0 then paid := paid - need; end if;
        bay := null;
      else
        fixes := fixes || jsonb_build_object(fk, 'still in the bay');
        cars := (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(cars) x where x ->> 'uid' is distinct from out_uid);
        s := jsonb_set(s, '{cars}', cars);
        s := jsonb_set(s, array[bk], case when orr ->> 'uid' = out_uid then orr
          else jsonb_build_object('uid', out_uid, 'model', bay ->> 'model', 'rarity', 'rare', 'minutes', (bay ->> 'mins')::numeric,
                                  'endsAt', ((bay ->> 'at')::numeric + (bay ->> 'mins')::numeric * 60) * 1000) end);
        removed := true;
      end if;
    elsif sr is not null then
      if bay is null or bay ->> 'uid' is distinct from sr ->> 'uid' or bay ->> 'model' is distinct from sr ->> 'model' then
        -- A car goes into the bay: one Rusty found and that hasn't been restored, or one already in
        -- storage from before the server rolled searches. Its timer starts now, at its rarity's pace.
        select * into f from econ_private.rescue_find(sr ->> 'uid');
        ok := case when f.model is not null then f.model = sr ->> 'model' and not f.bayed
          else exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'junkyard') = 'array' then o -> 'junkyard' else '[]' end) x
                       where x ->> 'uid' = sr ->> 'uid' and x ->> 'model' = sr ->> 'model') end;
        if ok then
          bay := jsonb_build_object('uid', sr ->> 'uid', 'model', sr ->> 'model', 'at', now_s,
                                    'mins', coalesce((rar -> (f.rarity) ->> 'minutes')::numeric, (rmins ->> (sr ->> 'model'))::numeric, 120), 'rushed', false);
          if f.model is not null then
            perform econ_private.rescue_bayed(sr ->> 'uid');
          end if;
        else
          fixes := fixes || jsonb_build_object(fk, 'not in storage');
          s := jsonb_set(s, array[bk], coalesce(orr, 'null'));
          bay := case when orr is not null then bay end;
        end if;
      -- (endsAt is in milliseconds, past econ_num()'s 1e12 cap since 2001, so it's read as is.)
      elsif not (bay ->> 'rushed')::boolean and jsonb_typeof(sr -> 'endsAt') = 'number' and jsonb_typeof(orr -> 'endsAt') = 'number'
            and (sr ->> 'endsAt')::numeric < (orr ->> 'endsAt')::numeric - 1000 then
        -- Rushed: paid for if this save's bucks cover the time left (with a minute to spare).
        left_s := (bay ->> 'at')::numeric + (bay ->> 'mins')::numeric * 60 - now_s - 60;
        need := greatest(1, ceil(left_s / 1800));
        if left_s <= 0 or paid >= need then
          if left_s > 0 then paid := paid - need; end if;
          bay := bay || '{"rushed":true}';
        else
          fixes := fixes || jsonb_build_object(fk, 'rush not paid');
          s := jsonb_set(s, array[bk], orr);
        end if;
      end if;
    else
      bay := null;
    end if;
    e := case when bay is null then e - ek else e || jsonb_build_object(ek, bay) end;
  end loop;

  -- Tow truck: up one level at a time, at the player level it needs, paid for in parts this
  -- save. A save with a lower level (an old tab) keeps the truck without a flag.
  t_o := greatest(coalesce(floor(public.econ_num(o, 'truck')), 0), 0)::int;
  t_n := coalesce(floor(public.econ_num(s, 'truck')), 0)::int;
  if t_n < t_o then
    s := jsonb_set(s, '{truck}', to_jsonb(t_o));
    keep := true;
  elsif t_n > t_o and (t_n <> t_o + 1 or t_n >= jsonb_array_length(truck)
        or (not adm and public.econ_num(s, 'level') < (truck -> t_n ->> 'level')::numeric)
        or public.econ_num(o, 'parts') - public.econ_num(s, 'parts') < (truck -> t_n ->> 'parts')::numeric) then
    fixes := fixes || jsonb_build_object('truck', t_o);
    s := jsonb_set(s, '{truck}', to_jsonb(t_o));
  end if;

  -- 3. Grand Prix ---------------------------------------------------------------------------
  my_pi := coalesce((old.best_car ->> 'pi')::int, 0); -- the best car from before this save
  for k, v in select g.key, g.value from jsonb_each(coalesce(cat -> 'gp', '{}')) g loop
    oc := public.econ_num(o -> 'gp' -> k, 'clears');
    sc := public.econ_num(s -> 'gp' -> k, 'clears');
    if sc < oc then
      fixes := fixes || jsonb_build_object('gp_' || k, 'clears kept');
      s := jsonb_set(s, '{gp}', coalesce(case when jsonb_typeof(s -> 'gp') = 'object' then s -> 'gp' end, '{}')
                                || jsonb_build_object(k, o -> 'gp' -> k));
    elsif sc > oc and gp_last ? k then
      rival := round((gp_last -> k ->> 'last')::numeric * (1 + oc * 0.08));
      if rival > jsonb_array_length(beat) or my_pi < (beat ->> (rival - 1))::int then
        fixes := fixes || jsonb_build_object('gp_' || k, 'rival too fast');
        s := jsonb_set(s, '{gp}', s -> 'gp' || jsonb_build_object(k, coalesce(o -> 'gp' -> k, jsonb_build_object('round', 0, 'clears', oc))));
        select x ->> 'uid' into prize from jsonb_array_elements(cars) x
          where not (x ->> 'uid') = any(o_uids) and v -> 'box' ? (x ->> 'model') limit 1;
        if prize is not null then
          cars := (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(cars) x where x ->> 'uid' is distinct from prize);
          s := jsonb_set(s, '{cars}', cars);
          removed := true;
        end if;
        s := jsonb_set(s, '{trophies}', to_jsonb(greatest(public.econ_num(o, 'trophies'), public.econ_num(s, 'trophies') - 5)));
      end if;
    end if;
  end loop;

  new.econ := e;
  if keep and fixes = '{}' then
    new.state := s;
  end if;
  if fixes <> '{}' then
    new.state := s;
    new.corrections := coalesce(new.corrections, '{}') || fixes;
    perform econ_private.econ_flag(new.owner_id, fixes);
  end if;
  if removed then
    -- Public columns, as the guard works them out, without the car taken back.
    select coalesce(sum(pi), 0) into new.power from (
      select public.econ_car_pi(x, cat) pi from jsonb_array_elements(cars) x
      where cat -> 'cars' ? (x ->> 'model') order by 1 desc limit 5) top;
    select jsonb_build_object('name', cat -> 'cars' -> (x ->> 'model') ->> 'name', 'color', x ->> 'color',
                              'pi', public.econ_car_pi(x, cat), 'body', cat -> 'cars' -> (x ->> 'model') ->> 'body',
                              'mods', (select coalesce(jsonb_agg(fm.id), '[]') from public.econ_fitted_mods(x, cat) fm))
      into new.best_car
      from jsonb_array_elements(cars) x
      where cat -> 'cars' ? (x ->> 'model') order by public.econ_car_pi(x, cat) desc limit 1;
  end if;
  return new;
end $$;
