-- Rusty's Old Race Track gets better finds (2026-10-11). A $15,000 search there used to turn up a
-- lone common Kodiak Gravel Rex (rally) about one time in four, worth less than the search. Now its
-- commons are the Liberty Sidewinder and Endurance GT, its scarce cars the Brawler and Silver Wing
-- 300, and its rares the Ronin GT and Hyperion (RESCUE_SPOTS in src/game/data.ts).
-- Only the spot tables change: rescue_roll() (0024), visitor_claim()'s barn finds (0032) and the
-- restore minutes in econ_progress() (0035), each copied from what is live with the new tables.
-- guardTables.test.ts keeps them in step.

create or replace function public.rescue_roll(spot text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- rescue:begin
  spots jsonb := $spots${"suburbs":{"unlock":1,"cars":[["pip","common"],["civic","common"],["bug","common"],["woodie","scarce"],["trail","scarce"],["miata","rare"]]},"farm":{"unlock":3,"cars":[["bug","common"],["trail","common"],["hauler","common"],["woodie","scarce"],["buggy","scarce"],["stallion","rare"]]},"downtown":{"unlock":5,"cars":[["civic","common"],["cruiser","common"],["rally","scarce"],["bandit","scarce"],["stallion","scarce"],["vette","rare"]]},"desert":{"unlock":7,"cars":[["buggy","common"],["hauler","common"],["bandit","scarce"],["charger","scarce"],["lemans","rare"],["gtr","rare"],["speedster","rare"]]},"track":{"unlock":10,"cars":[["vette","common"],["lemans","common"],["charger","scarce"],["gullwing","scarce"],["gtr","rare"],["hyper","rare"]]}}$spots$::jsonb;
  rar jsonb := $rarity${"common":{"weight":60,"minutes":5},"scarce":{"weight":30,"minutes":30},"rare":{"weight":10,"minutes":120}}$rarity$::jsonb;
  roll jsonb := $roll${"pins":8,"car":0.1}$roll$::jsonb;
  -- rescue:end
  -- What a search at each spot costs (RESCUE_SPOTS in src/game/data.ts).
  -- spotcost:begin
  costs jsonb := $spotcost${"suburbs":500,"farm":1500,"downtown":3500,"desert":7000,"track":15000}$spotcost$::jsonb;
  -- spotcost:end
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
  select g.level into lvl from public.game_saves g where g.owner_id = me;
  if coalesce(lvl, 0) < (sp ->> 'unlock')::int then
    raise exception 'spot not open yet' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('rescue:' || me::text));
  if exists (select 1 from econ_private.rescue_finds f where f.owner_id = me and f.created_at > now() - interval '10 seconds') then
    raise exception 'Rusty is still out' using errcode = 'P0001';
  end if;
  for i in 0 .. (roll ->> 'pins')::int - 1 loop
    if random() < (roll ->> 'car')::numeric then pins := pins || i; end if;
  end loop;
  if cardinality(pins) = 0 then
    pins := array[floor(random() * (roll ->> 'pins')::int)::int];
  end if;
  select sum((rar -> (x ->> 1) ->> 'weight')::numeric) into total from jsonb_array_elements(sp -> 'cars') x;
  foreach i in array pins loop
    r := random() * total;
    for c in select x from jsonb_array_elements(sp -> 'cars') x loop
      r := r - (rar -> (c ->> 1) ->> 'weight')::numeric;
      exit when r <= 0;
    end loop;
    u := 'r' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14);
    insert into econ_private.rescue_finds (uid, owner_id, spot, model, rarity, cost)
      values (u, me, spot, c ->> 0, c ->> 1, round(coalesce((costs ->> spot)::numeric, 0) / cardinality(pins)));
    cars := cars || jsonb_build_object('i', i, 'uid', u, 'model', c ->> 0, 'rarity', c ->> 1);
  end loop;
  return jsonb_build_object('cars', cars);
end $$;

create or replace function public.visitor_claim(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- barnspots:begin
  spots jsonb := $barnspots${"suburbs":{"unlock":1,"cars":[["pip","common"],["civic","common"],["bug","common"],["woodie","scarce"],["trail","scarce"],["miata","rare"]]},"farm":{"unlock":3,"cars":[["bug","common"],["trail","common"],["hauler","common"],["woodie","scarce"],["buggy","scarce"],["stallion","rare"]]},"downtown":{"unlock":5,"cars":[["civic","common"],["cruiser","common"],["rally","scarce"],["bandit","scarce"],["stallion","scarce"],["vette","rare"]]},"desert":{"unlock":7,"cars":[["buggy","common"],["hauler","common"],["bandit","scarce"],["charger","scarce"],["lemans","rare"],["gtr","rare"],["speedster","rare"]]},"track":{"unlock":10,"cars":[["vette","common"],["lemans","common"],["charger","scarce"],["gullwing","scarce"],["gtr","rare"],["hyper","rare"]]}}$barnspots$::jsonb;
  -- barnspots:end
  -- visitors:begin
  t jsonb := $visitors${"kinds":{"racer":{"weight":30,"minutes":5,"coins":60,"coinsPerLevel":15,"xp":0,"xpPerLevel":0,"parts":3,"bucksChance":0.05},"tourist":{"weight":40,"minutes":5,"coins":30,"coinsPerLevel":6,"xp":3,"xpPerLevel":1,"parts":0,"bucksChance":0},"mystery":{"weight":25,"minutes":0.5,"coins":60,"coinsPerLevel":12,"xp":10,"xpPerLevel":2,"parts":2,"bucksChance":0.1},"barn":{"weight":5,"minutes":10,"coins":0,"coinsPerLevel":0,"xp":0,"xpPerLevel":0,"parts":0,"bucksChance":0}},"gap":4,"perDay":30,"barn":{"common":70,"scarce":25,"rare":5},"barnPerDay":1}$visitors$::jsonb;
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

create or replace function econ_private.econ_progress() returns trigger
language plpgsql set search_path = '' as $$
declare
  o jsonb := old.state;
  s jsonb := new.state;
  e jsonb := coalesce(new.econ, '{}');
  bay jsonb := old.econ -> 'bay'; -- the server's record of the car in the restore bay
  fixes jsonb := '{}';
  now_s numeric := extract(epoch from now());
  -- Shortest restore minutes per car (src/game/guardTables.ts, restoreMinutes()).
  -- restore:begin
  rmins jsonb := $restoremin${"pip":5,"civic":5,"bug":5,"woodie":30,"trail":5,"miata":120,"hauler":5,"buggy":5,"stallion":30,"cruiser":5,"rally":30,"bandit":30,"vette":5,"charger":30,"lemans":5,"gtr":120,"speedster":120,"gullwing":30,"hyper":120}$restoremin$::jsonb;
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
  beat jsonb := $gpbeat$[1,2,3,4,4,5,6,7,7,8,9,10,10,11,12,12,13,14,15,15,16,17,17,18,19,20,20,21,22,22,23,24,25,25,26,27,27,28,29,29,30,31,32,32,33,34,34,35,36,36,37,38,38,39,40,40,41,42,42,43,44,44,45,46,46,47,48,48,49,50,50,51,52,52,53,54,54,55,55,56,57,57,58,59,59,60,61,61,62,63,63,64,64,65,66,66,67,67,68,69,69,70,71,71,72,73,73,74,75,75,76,76,77,78,78,79,79,80,81,81,82,83,83,84,84,85,85,86,87,87,88,88,89,90,90,91,91,92,93,93,94,94,95,95,96,97,97,98,98,99,100,100,101,102,102,103,103,104,104,105,106,106,107,107,108,108,109,109,110,111,112,112,112,113,114,114,115,115,116,116,117,118,118,119,119,120,121,121,122,122,123,123,124,125,125,126,127,127,128,128,128,129,130,130,131,131,132,133,133,134,134,135,135,136,136,137,138,138,139,140,140,141,141,141,142,142,143,143,144,145,146,146,147,147,148,148,149,149,150,151,151,152,152,153,153,154,154,155,155,156,157,157,158,159,159,159,160,161,161,161,162,163,163,163,165,165,166,166,166,167,168,168,169,170,170,170,171,171,172,172,173,174,175,175,175,176,176,177,177,178,179,179,180,180,181,182,182,183,183,184,184,185,185,186,186,187,187,188,188,189,189,190,191,191,191,193,193,194,194,195,195,195,196,196,197,197,198,199,199,200,200,200,201,201,203,203,204,204,204,205,206,206,207,207,207,208,209,209,210,210,210,211,212,212,213,213,214,215,216,216,216,217,217,218,218,219,219,220,220,221,221,222,222,223,223,224,224,225,226,226,227,228,228,228,229,230,230,231,231,231,232,233,233,233,234,234,235,236,236,236]$gpbeat$::jsonb;
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
  cat := public.econ_catalog();
  cars := case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end;
  o_uids := array(select x ->> 'uid' from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) x);
  orr := case when jsonb_typeof(o -> 'restoring') = 'object' then o -> 'restoring' end;
  sr := case when jsonb_typeof(s -> 'restoring') = 'object' then s -> 'restoring' end;
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

  -- 2. Restore bay ---------------------------------------------------------------------------
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
    done := (bay ->> 'rushed')::boolean or left_s <= 0 or paid >= greatest(1, ceil(left_s / 1800));
    if done then
      bay := null;
    else
      fixes := fixes || '{"restore":"still in the bay"}';
      cars := (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(cars) x where x ->> 'uid' is distinct from out_uid);
      s := jsonb_set(s, '{cars}', cars);
      s := jsonb_set(s, '{restoring}', case when orr ->> 'uid' = out_uid then orr
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
        fixes := fixes || '{"restore":"not in storage"}';
        s := jsonb_set(s, '{restoring}', coalesce(orr, 'null'));
      end if;
    elsif not (bay ->> 'rushed')::boolean and public.econ_num(sr, 'endsAt') < public.econ_num(orr, 'endsAt') - 1000 then
      -- Rushed: paid for if this save's bucks cover the time left (with a minute to spare).
      left_s := (bay ->> 'at')::numeric + (bay ->> 'mins')::numeric * 60 - now_s - 60;
      if left_s <= 0 or paid >= greatest(1, ceil(left_s / 1800)) then
        bay := bay || '{"rushed":true}';
      else
        fixes := fixes || '{"restore":"rush not paid"}';
        s := jsonb_set(s, '{restoring}', orr);
      end if;
    end if;
  else
    bay := null;
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

  new.econ := case when bay is null then e - 'bay' else e || jsonb_build_object('bay', bay) end;
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
                              'mods', (select coalesce(jsonb_agg(f.id), '[]') from public.econ_fitted_mods(x, cat) f))
      into new.best_car
      from jsonb_array_elements(cars) x
      where cat -> 'cars' ? (x ->> 'model') order by public.econ_car_pi(x, cat) desc limit 1;
  end if;
  return new;
end $$;
