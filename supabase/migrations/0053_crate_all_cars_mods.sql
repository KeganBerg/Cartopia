-- Every car and part in crates (2026-10-12, "Every car and mod in crates", PR #235): each car and
-- part has one home crate by what it's worth (carCrate()/modCrate() in src/game/crates.ts), and
-- crate_open() rolls from the crate's own cars and parts, or the crate below's when none are in
-- reach yet. The car slice shrinks until it's worth at most carShare of the crate (crateOdds()),
-- the rest going to coins. Rusty's classics are in the pool now; car_granted() already keeps any
-- crate car, so no guard change. Tables regenerated from crateTables(); otherwise 0046.
-- Run it together with the game update (just after it goes live) so the odds shown match.

create or replace function public.crate_open(p_crate text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- crates:begin
  t jsonb := $crates${"crates":{"street":{"pay":"coins","unlock":2,"base":300,"perLevel":120,"odds":{"coins":56,"jackpot":6,"mod":28,"car":10,"skin":0},"carShare":0.12,"coinMult":[0.5,1],"jackpotMult":[2,3],"skins":[],"below":null},"garage":{"pay":"coins","unlock":6,"base":1500,"perLevel":500,"odds":{"coins":41,"jackpot":8,"mod":31,"car":16,"skin":4},"carShare":0.15,"coinMult":[0.45,0.85],"jackpotMult":[2,3],"skins":["rare","epic"],"below":"street"},"gold":{"pay":"bucks","unlock":3,"base":8,"perLevel":0,"odds":{"coins":34,"jackpot":6,"mod":30,"car":20,"skin":10},"carShare":0.15,"coinMult":[0.45,0.85],"jackpotMult":[2,3],"skins":["rare","epic","legendary"],"below":"garage"},"diamond":{"pay":"bucks","unlock":8,"base":25,"perLevel":0,"odds":{"coins":24,"jackpot":6,"mod":24,"car":32,"skin":14},"carShare":0.2,"coinMult":[0.4,0.8],"jackpotMult":[2,3],"skins":["epic","legendary"],"below":"gold"}},"skinWeight":{"rare":6,"epic":3,"legendary":1},"skinDupe":{"rare":0.6,"epic":1,"legendary":1.5},"skins":{"hexcore":{"tier":"rare","level":3},"riptide":{"tier":"rare","set":"daily"},"overclock":{"tier":"rare","level":10},"static":{"tier":"rare"},"contour":{"tier":"rare","set":"roadtrip"},"cascade":{"tier":"rare","level":15},"ghostcamo":{"tier":"rare","set":"heavy"},"deepspace":{"tier":"epic"},"faultline":{"tier":"epic","set":"muscle"},"aurora":{"tier":"epic"},"thunderhead":{"tier":"epic"},"biolume":{"tier":"epic"},"nightdrive":{"tier":"epic"},"petalstorm":{"tier":"epic"},"prismatic":{"tier":"legendary"},"horizon":{"tier":"legendary"},"coldsnap":{"tier":"legendary"},"quicksilver":{"tier":"legendary"},"wyrmscale":{"tier":"legendary"},"kaleido":{"tier":"legendary"}},"modSkins":{"ember":{"tier":"rare","level":5},"hexplate":{"tier":"rare","level":7},"neonpulse":{"tier":"rare","set":"tuners"},"tracer":{"tier":"rare","level":12},"checkered":{"tier":"rare","set":"track"},"goldleaf":{"tier":"epic"},"carbonprism":{"tier":"epic"},"starlight":{"tier":"epic"},"toxic":{"tier":"epic"},"stormcell":{"tier":"epic"},"biobloom":{"tier":"epic"},"holofoil":{"tier":"legendary"},"rime":{"tier":"legendary"},"mercury":{"tier":"legendary"},"dragonhide":{"tier":"legendary"}},"gem":{"base":300,"perLevel":100},"cars":{"pip":{"body":"compact","crate":"street","unlock":1,"price":800,"bucks":0,"colors":["#c62828","#1b5e20","#fafafa"]},"civic":{"body":"sedan","crate":"street","unlock":1,"price":1500,"bucks":0,"colors":["#1e88e5","#eeeeee","#424242"]},"trail":{"body":"truck","crate":"street","unlock":3,"price":3500,"bucks":0,"colors":["#0d47a1","#c62828","#eceff1"]},"miata":{"body":"roadster","crate":"street","unlock":5,"price":7000,"bucks":0,"colors":["#d32f2f","#1e88e5","#fafafa"]},"stallion":{"body":"muscle","crate":"garage","unlock":7,"price":14000,"bucks":0,"colors":["#1b5e20","#ff6f00","#212121"]},"rally":{"body":"rally","crate":"garage","unlock":10,"price":26000,"bucks":0,"colors":["#0d47a1","#fafafa","#ffd600"]},"vette":{"body":"sports","crate":"gold","unlock":15,"price":55000,"bucks":0,"colors":["#b71c1c","#bdbdbd","#ffd600"]},"charger":{"body":"muscle","crate":"gold","unlock":13,"price":42000,"bucks":0,"colors":["#212121","#ff5722","#6a1b9a"]},"hellcat":{"body":"widebody","crate":"gold","unlock":18,"price":80000,"bucks":0,"colors":["#c62828","#7b1fa2","#9ccc65"]},"gtr":{"body":"coupe","crate":"gold","unlock":22,"price":115000,"bucks":0,"colors":["#eceff1","#263238","#ff6d00"]},"tomahawk":{"body":"tank","crate":"diamond","unlock":36,"price":420000,"bucks":0,"colors":["#556b2f","#37474f","#c9a227"]},"zippy":{"body":"scooter","crate":"street","unlock":2,"price":2100,"bucks":0,"colors":["#4dd0e1","#fdd835","#f48fb1"]},"baron":{"body":"chopper","crate":"garage","unlock":7,"price":16000,"bucks":0,"colors":["#212121","#b71c1c","#1565c0"]},"shinden":{"body":"sportbike","crate":"diamond","unlock":24,"price":135000,"bucks":0,"colors":["#1565c0","#eceff1","#76ff03"]},"camper":{"body":"van","crate":"street","unlock":2,"price":2800,"bucks":0,"colors":["#ff8a65","#4db6ac","#fff59d"]},"hotshot":{"body":"hatch","crate":"street","unlock":5,"price":7000,"bucks":0,"colors":["#eceff1","#d32f2f","#1e88e5"]},"ridgeback":{"body":"suv","crate":"street","unlock":6,"price":10000,"bucks":0,"colors":["#ff6f00","#33691e","#eceff1"]},"kitsune":{"body":"coupe","crate":"garage","unlock":9,"price":20000,"bucks":0,"colors":["#fafafa","#212121","#ff4081"]},"current":{"body":"ev","crate":"gold","unlock":16,"price":62000,"bucks":0,"colors":["#eceff1","#b71c1c","#263238"]},"salon":{"body":"luxury","crate":"gold","unlock":11,"price":0,"bucks":45,"colors":["#1a1a2e","#eceff1","#6d1b1b"]},"stomper":{"body":"truck","crate":"garage","unlock":12,"price":36000,"bucks":0,"colors":["#424242","#1565c0","#ff6d00"]},"monoposto":{"body":"formula","crate":"diamond","unlock":30,"price":220000,"bucks":0,"colors":["#d50000","#eceff1","#00897b"]},"zenith":{"body":"super","crate":"diamond","unlock":40,"price":550000,"bucks":0,"colors":["#212121","#1e88e5","#ff6d00"]},"schoolbus":{"body":"bus","crate":"street","unlock":4,"price":6500,"bucks":0,"colors":["#fbc02d","#ff8f00","#eceff1"]},"shaggy":{"body":"dogvan","crate":"street","unlock":5,"price":8000,"bucks":0,"colors":["#d7ccc8","#a1887f","#9e9e9e"]},"tusker":{"body":"tusker","crate":"gold","unlock":20,"price":95000,"bucks":0,"colors":["#6b7a3a","#c2a36b","#eceff1"]},"lambo":{"body":"wedge","crate":"diamond","unlock":26,"price":0,"bucks":90,"colors":["#fdd835","#d50000","#fafafa"]},"hyper":{"body":"super","crate":"diamond","unlock":33,"price":300000,"bucks":0,"colors":["#1a237e","#212121","#d50000"]},"bug":{"body":"bubble","crate":"street","unlock":1,"price":1200,"bucks":0,"colors":["#80cbc4","#ffcc80","#ef9a9a"]},"woodie":{"body":"wagon","crate":"street","unlock":1,"price":2200,"bucks":0,"colors":["#fafafa","#fff59d","#4db6ac"]},"hauler":{"body":"truck","crate":"street","unlock":1,"price":3000,"bucks":0,"colors":["#558b2f","#e65100","#1565c0"]},"cruiser":{"body":"classic","crate":"street","unlock":1,"price":5000,"bucks":0,"colors":["#4dd0e1","#f06292","#fafafa"]},"buggy":{"body":"offroad","crate":"street","unlock":1,"price":6000,"bucks":0,"colors":["#ff9800","#cddc39","#29b6f6"]},"bandit":{"body":"muscle","crate":"street","unlock":1,"price":8000,"bucks":0,"colors":["#212121","#ffd54f","#b71c1c"]},"lemans":{"body":"super","crate":"garage","unlock":1,"price":16000,"bucks":0,"colors":["#1565c0","#fafafa","#c62828"]},"gullwing":{"body":"coupe","crate":"garage","unlock":1,"price":30000,"bucks":0,"colors":["#cfd8dc","#b71c1c","#263238"]},"speedster":{"body":"roadster","crate":"garage","unlock":1,"price":12000,"bucks":0,"colors":["#1565c0","#eceff1","#b71c1c"]},"nightfall":{"body":"wedge","crate":null,"unlock":1,"price":24000,"bucks":0,"colors":["#311b92","#00e5ff","#212121"]}},"mods":{"ducktail":{"crate":"street","unlock":2,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"gtwing":{"crate":"garage","unlock":5,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"attackwing":{"crate":"diamond","unlock":12,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"twintips":{"crate":"street","unlock":2},"sidepipes":{"crate":"garage","unlock":4},"flamepipes":{"crate":"gold","unlock":12},"streetkit":{"crate":"street","unlock":3,"notOn":["scooter","chopper","sportbike"]},"widebody":{"crate":"garage","unlock":6,"notOn":["scooter","chopper","sportbike"]},"carbonkit":{"crate":"diamond","unlock":16,"notOn":["scooter","chopper","sportbike"]},"vented":{"crate":"street","unlock":2,"notOn":["scooter","chopper","sportbike","formula"]},"ramscoop":{"crate":"garage","unlock":4,"notOn":["scooter","chopper","sportbike","formula"]},"blower":{"crate":"garage","unlock":7,"notOn":["scooter","chopper","sportbike","formula"]},"chrome":{"crate":"street","unlock":1},"goldmesh":{"crate":"garage","unlock":4},"luggage":{"crate":"street","unlock":3,"only":["bus"]},"stacks":{"crate":"garage","unlock":3,"only":["bus"]},"cowcatcher":{"crate":"garage","unlock":4,"only":["bus"]},"disco":{"crate":"gold","unlock":5,"only":["bus"]},"flag":{"crate":"garage","unlock":10,"only":["tank"]},"smoke":{"crate":"gold","unlock":10,"only":["tank"]},"reactive":{"crate":"garage","unlock":10,"only":["tank"]},"watercannon":{"crate":"diamond","unlock":10,"only":["tank"]},"bigtail":{"crate":"street","unlock":4,"only":["dogvan"]},"bubbles":{"crate":"gold","unlock":4,"only":["dogvan"]},"collar":{"crate":"street","unlock":4,"only":["dogvan"]},"bone":{"crate":"street","unlock":4,"only":["dogvan"]},"radar":{"crate":"garage","unlock":9,"only":["tusker"]},"snorkel":{"crate":"garage","unlock":9,"only":["tusker"]},"plating":{"crate":"garage","unlock":9,"only":["tusker"]},"lightbar":{"crate":"garage","unlock":9,"only":["tusker"]},"tailfairing":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"saddlebags":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"windscreen":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"campod":{"crate":"street","unlock":11,"only":["formula"]},"bargeboards":{"crate":"gold","unlock":11,"only":["formula"]},"raintires":{"crate":"garage","unlock":3},"sandtires":{"crate":"garage","unlock":4},"snowstuds":{"crate":"garage","unlock":4},"allweather":{"crate":"gold","unlock":7},"forged":{"crate":"garage","unlock":7}}}$crates$::jsonb;
  -- crates:end
  c jsonb := t -> 'crates' -> p_crate;
  st jsonb;
  lvl int;
  saved int;
  last_seq int;
  pend jsonb;
  price int;
  gemc numeric;
  v numeric;
  cost_c int := 0;
  cost_b int := 0;
  kind text;
  r numeric;
  total numeric;
  k record;
  car jsonb;
  cdef jsonb;
  have jsonb;
  mods jsonb;
  choices jsonb := '[]';
  pick jsonb;
  m record;
  pool jsonb := '[]';
  cv numeric;
  lo numeric;
  hi numeric;
  o public.crate_opens;
  cars_pool jsonb;
  cc text;
  odds jsonb;
  avg float8;
  car_w numeric;
  owned boolean;
begin
  if me is null then
    raise exception 'sign in to open crates' using errcode = 'insufficient_privilege';
  end if;
  if c is null then
    raise exception 'no such crate' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('crate:' || me::text));
  select g.state, g.level into st, lvl from public.game_saves g where g.owner_id = me;
  if jsonb_typeof(st) is distinct from 'object' then
    raise exception 'no saved town yet' using errcode = 'P0001';
  end if;
  lvl := greatest(coalesce(lvl, 1), 1);
  select coalesce(max(x.seq), 0) into last_seq from public.crate_opens x where x.owner_id = me;
  saved := floor(public.econ_num(st, 'crates'))::int;
  -- Opens the save hasn't counted yet go back to the game first.
  if saved < last_seq then
    select coalesce(jsonb_agg(econ_private.crate_json(x) order by x.seq), '[]') into pend
      from public.crate_opens x where x.owner_id = me and x.seq > saved;
    return jsonb_build_object('pending', pend);
  end if;
  if exists (select 1 from public.crate_opens x where x.owner_id = me and x.created_at > now() - interval '1.5 seconds') then
    raise exception 'one crate at a time' using errcode = 'P0001';
  end if;
  if lvl < (c ->> 'unlock')::int then
    raise exception 'crate not open yet' using errcode = 'insufficient_privilege';
  end if;
  price := (c ->> 'base')::int + (c ->> 'perLevel')::int * lvl;
  gemc := (t -> 'gem' ->> 'base')::numeric + (t -> 'gem' ->> 'perLevel')::numeric * lvl;
  if c ->> 'pay' = 'coins' then
    cost_c := price;
    v := price;
    if public.econ_num(st, 'coins') < price then
      raise exception 'not enough coins' using errcode = 'P0001';
    end if;
  else
    cost_b := price;
    v := price * gemc;
    if public.econ_num(st, 'bucks') < price then
      raise exception 'not enough gems' using errcode = 'P0001';
    end if;
  end if;

  -- The cars it can give: its own cars (by home crate) the level has unlocked, or the crate
  -- below's when none of its own are in reach yet.
  cc := p_crate;
  loop
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'v', (e.value ->> 'price')::numeric + (e.value ->> 'bucks')::numeric * gemc, 'colors', e.value -> 'colors') order by e.key), '[]')
      into pool from jsonb_each(t -> 'cars') e
      where e.value ->> 'crate' = cc and (e.value ->> 'unlock')::int <= lvl;
    exit when jsonb_array_length(pool) > 0 or jsonb_typeof(t -> 'crates' -> cc -> 'below') is distinct from 'string';
    cc := t -> 'crates' -> cc ->> 'below';
  end loop;
  cars_pool := pool;

  -- The odds (crateOdds()): the car slice shrinks until its average car (weighed 1 / value) is
  -- worth no more than carShare of the crate, and what it loses goes to coins.
  odds := c -> 'odds';
  if jsonb_array_length(pool) > 0 then
    select count(*)::float8 / sum(1 / (x ->> 'v')::float8) into avg from jsonb_array_elements(pool) x;
    car_w := least((odds ->> 'car')::numeric, floor(1000 * (c ->> 'carShare')::float8 * v::float8 / avg)::numeric / 10);
    odds := odds || jsonb_build_object('coins', (odds ->> 'coins')::numeric + (odds ->> 'car')::numeric - car_w, 'car', car_w);
  end if;

  -- What kind of prize.
  select sum(value::numeric) into total from jsonb_each_text(odds);
  r := random()::numeric * total;
  for k in select key, value::numeric as w from jsonb_each_text(odds) order by array_position(array['coins', 'jackpot', 'mod', 'car', 'skin'], key) loop
    kind := k.key;
    r := r - k.w;
    exit when r <= 0;
  end loop;

  -- A part: for one of the player's cars, one of the crate's own parts (by home crate), unlocked
  -- and not already owned; the crate below's when none of its own fit any car.
  if kind = 'mod' then
    cc := p_crate;
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
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, car_uid, mod)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, 'mod', pick ->> 'car', (pick -> 'mods') ->> floor(random()::numeric * jsonb_array_length(pick -> 'mods'))::int)
        returning * into o;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A skin: a body or part skin of the crate's tiers (rarer tiers less likely). One the player
  -- already has (bought, won, or unlocked by level or collection set) pays coins instead.
  if kind = 'skin' then
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'part', e.part, 'tier', e.value ->> 'tier', 'level', e.value -> 'level', 'set', e.value -> 'set') order by e.part, e.key), '[]')
      into pool from (select false as part, x.key, x.value from jsonb_each(t -> 'skins') x
                      union all select true, y.key, y.value from jsonb_each(t -> 'modSkins') y) e
      where (c -> 'skins') ? (e.value ->> 'tier');
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
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, coins, skin, part)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, case when owned then 'skindupe' else 'skin' end,
          case when owned then econ_private.crate_round(v * (t -> 'skinDupe' ->> (pick ->> 'tier'))::numeric) else 0 end,
          pick ->> 'id', (pick ->> 'part')::boolean)
        returning * into o;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A car: from the pool above; cheaper is likelier (weight 1 / value).
  if kind = 'car' then
    pool := cars_pool;
    if jsonb_array_length(pool) > 0 then
      select sum(1 / (x ->> 'v')::numeric) into total from jsonb_array_elements(pool) x;
      r := random()::numeric * total;
      for pick in select x from jsonb_array_elements(pool) x loop
        r := r - 1 / (pick ->> 'v')::numeric;
        exit when r <= 0;
      end loop;
      cv := (pick ->> 'v')::numeric;
      if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(st -> 'cars') = 'array' then st -> 'cars' else '[]' end) x
                 where jsonb_typeof(x) = 'object' and x ->> 'model' = pick ->> 'id') then
        insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, coins, model)
          values (me, last_seq + 1, p_crate, cost_c, cost_b, 'dupe', econ_private.crate_round(least(v * 1.5, greatest(v * 0.5, cv * 0.4))), pick ->> 'id')
          returning * into o;
      else
        insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, model, car_uid, color)
          values (me, last_seq + 1, p_crate, cost_c, cost_b, 'car', pick ->> 'id',
            'k' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14),
            (pick -> 'colors') ->> floor(random()::numeric * jsonb_array_length(pick -> 'colors'))::int)
          returning * into o;
      end if;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- Coins: a share of what the crate is worth (a jackpot pays two to three times it or more).
  lo := ((c -> case when kind = 'jackpot' then 'jackpotMult' else 'coinMult' end) ->> 0)::numeric;
  hi := ((c -> case when kind = 'jackpot' then 'jackpotMult' else 'coinMult' end) ->> 1)::numeric;
  insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, coins)
    values (me, last_seq + 1, p_crate, cost_c, cost_b, kind, econ_private.crate_round(v * (lo + (hi - lo) * random()::numeric)))
    returning * into o;
  return econ_private.crate_json(o);
end $$;
