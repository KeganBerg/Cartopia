-- Race launch and boost (src/game/race.ts). Races now start with a launch the player times on
-- GO, and a boost tank (filled by a clean launch and clean shifts) the player fires once a race.
-- A perfect run is quicker than before, so:
--   * race_floor(): the fastest finish for each PI, now with the boost fired at the best moment.
--     Used by the live race referee (0009) and the weekly time trial (0026).
--   * econ_private.econ_progress(): 0022 with only the Grand Prix table (gpBeatTable) regenerated:
--     the lowest car PI that can beat each rival is a little lower now. Nothing else changes.
-- Both only loosen checks, so this is safe to run before the game update goes live (and should be,
-- so nobody's quick boosted race is slowed to the old floor). Standalone: no econ_catalog() or
-- econ_guard() change.

-- Fastest finish for each PI (index = PI - 1), from raceFloor() in src/game/race.ts.
create or replace function public.race_floor(pi int) returns numeric
language sql immutable set search_path = '' as $$
-- floors:begin
select ($floors$[52.158,33.47,26.215,22.152,19.491,17.582,16.124,14.97,14.027,13.239,12.565,11.984,11.476,11.025,10.623,10.261,9.932,9.632,9.359,9.108,8.872,8.657,8.454,8.267,8.088,7.925,7.767,7.621,7.483,7.349,7.223,7.105,6.991,6.881,6.776,6.674,6.577,6.483,6.394,6.309,6.223,6.146,6.069,5.992,5.923,5.854,5.784,5.719,5.654,5.598,5.537,5.48,5.427,5.37,5.317,5.269,5.22,5.171,5.122,5.078,5.033,4.988,4.948,4.907,4.866,4.826,4.785,4.749,4.712,4.675,4.643,4.606,4.574,4.541,4.509,4.476,4.444,4.415,4.383,4.355,4.326,4.298,4.269,4.241,4.212,4.188,4.16,4.135,4.111,4.082,4.062,4.038,4.013,3.989,3.965,3.944,3.924,3.9,3.879,3.859,3.839,3.818,3.798,3.778,3.757,3.737,3.721,3.7,3.68,3.664,3.648,3.627,3.611,3.595,3.579,3.562,3.546,3.53,3.514,3.497,3.481,3.465,3.449,3.436,3.42,3.408,3.392,3.375,3.363,3.347,3.335,3.323,3.306,3.294,3.282,3.27,3.258,3.241,3.233,3.221,3.205,3.193,3.18,3.168,3.16,3.148,3.136,3.124,3.111,3.103,3.091,3.079,3.071,3.059,3.046,3.038,3.026,3.018,3.006,2.998,2.985,2.977,2.965,2.957,2.949,2.937,2.929,2.92,2.912,2.9,2.892,2.884,2.876,2.868,2.855,2.847,2.839,2.831,2.823,2.815,2.807,2.799,2.79,2.782,2.774,2.766,2.758,2.75,2.742,2.734,2.725,2.721,2.713,2.705,2.697,2.689,2.681,2.677,2.669,2.66,2.652,2.648,2.64,2.632,2.628,2.62,2.612,2.608,2.6,2.591,2.587,2.579,2.575,2.567,2.563,2.555,2.547,2.543,2.535,2.53,2.522,2.518,2.51,2.506,2.502,2.494,2.49,2.482,2.478,2.474,2.465,2.461,2.453,2.449,2.445,2.437,2.433,2.429,2.421,2.417,2.413,2.405,2.4,2.396,2.392,2.384,2.38,2.376,2.368,2.364]$floors$::jsonb ->> (least(greatest(pi, 1), 250) - 1))::numeric
-- floors:end
$$;

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
  rmins jsonb := $restoremin${"pip":5,"civic":5,"bug":5,"woodie":30,"trail":5,"miata":120,"hauler":5,"buggy":5,"stallion":30,"cruiser":5,"rally":5,"bandit":30,"vette":5,"charger":30,"lemans":30,"gtr":120,"speedster":120,"gullwing":120,"hyper":120}$restoremin$::jsonb;
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

revoke all on function econ_private.econ_progress() from public, anon, authenticated;
