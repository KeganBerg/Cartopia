-- Six-speed race gearbox (src/game/race.ts, 2026-10-11). Revs now follow road speed through a
-- six-speed box, so races run about 7 to 10 seconds instead of 3 to 9, the launch is set by the
-- revs held at GO, and the race screen steps the race on a fixed 240 Hz clock.
--   * race_floor(): the fastest finish for each PI under the new physics (raceFloor()). Slow cars
--     are a touch quicker than before and fast cars much slower. Used by the live race referee
--     (0009), the weekly time trial (0026) and friend ghost pars (0030).
--   * econ_private.econ_progress(): copied from 0037 (the live copy) with only the Grand Prix
--     table (gpBeatTable()) regenerated. Driving now counts for more against PI, so the lowest
--     car PI that can beat each rival is lower.
--   * Friend ghosts: times set before 2026-10-12 00:00 UTC (the old physics) can't be beaten any
--     more, so ghost_best() ignores them and ghost_submit() lets a new run replace them. Nothing
--     is deleted.
-- The GP table and the low-PI floors only loosen, so run this BEFORE the game update goes live.
-- Standalone: no econ_catalog() or econ_guard() change.

-- Fastest finish for each PI (index = PI - 1), from raceFloor() in src/game/race.ts.
create or replace function public.race_floor(pi int) returns numeric
language sql immutable set search_path = '' as $$
-- floors:begin
select ($floors$[9.936,9.896,9.851,9.806,9.766,9.721,9.68,9.64,9.599,9.559,9.518,9.481,9.441,9.404,9.364,9.327,9.29,9.254,9.217,9.181,9.144,9.112,9.075,9.043,9.006,8.974,8.941,8.909,8.876,8.839,8.807,8.779,8.746,8.714,8.685,8.653,8.624,8.592,8.563,8.531,8.502,8.474,8.445,8.417,8.389,8.36,8.332,8.307,8.279,8.25,8.226,8.198,8.173,8.145,8.12,8.092,8.068,8.043,8.019,7.994,7.97,7.946,7.921,7.897,7.873,7.848,7.824,7.804,7.779,7.755,7.734,7.71,7.686,7.665,7.645,7.621,7.6,7.576,7.556,7.535,7.515,7.495,7.474,7.45,7.43,7.409,7.389,7.369,7.349,7.332,7.312,7.292,7.271,7.255,7.235,7.214,7.198,7.178,7.158,7.141,7.121,7.101,7.084,7.064,7.048,7.032,7.011,6.995,6.975,6.959,6.942,6.922,6.906,6.889,6.873,6.853,6.837,6.82,6.804,6.788,6.772,6.755,6.739,6.723,6.707,6.69,6.674,6.658,6.646,6.629,6.613,6.597,6.581,6.564,6.552,6.536,6.524,6.508,6.491,6.479,6.463,6.451,6.434,6.422,6.406,6.394,6.378,6.365,6.349,6.337,6.321,6.309,6.296,6.284,6.268,6.256,6.244,6.227,6.215,6.203,6.191,6.179,6.166,6.15,6.138,6.126,6.114,6.101,6.089,6.077,6.065,6.053,6.04,6.028,6.016,6.004,5.992,5.979,5.967,5.959,5.943,5.935,5.923,5.91,5.898,5.886,5.878,5.866,5.854,5.845,5.833,5.821,5.809,5.801,5.789,5.78,5.768,5.756,5.748,5.736,5.724,5.715,5.703,5.695,5.683,5.675,5.663,5.654,5.642,5.634,5.622,5.614,5.606,5.594,5.585,5.573,5.565,5.557,5.545,5.537,5.524,5.516,5.508,5.5,5.488,5.48,5.472,5.46,5.451,5.443,5.435,5.423,5.415,5.407,5.399,5.39,5.382,5.37,5.362,5.354,5.346,5.338,5.33,5.321,5.313,5.301,5.293,5.285,5.277,5.269]$floors$::jsonb ->> (least(greatest(pi, 1), 250) - 1))::numeric
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

-- A player's ghost: their best under the new physics, from friend races or time trials.
create or replace function public.ghost_best(who uuid) returns table (t numeric, pi int, car text)
language sql stable security definer set search_path = '' as $$
  select b.t, b.pi, b.car from (
    select g.best_t t, g.pi, g.car, g.set_at at from public.ghost_runs g where g.owner_id = who and g.best_t is not null and g.set_at >= timestamptz '2026-10-12 00:00+00'
    union all
    select x.best_t, x.pi, x.car, x.set_at from public.time_trials x where x.owner_id = who and x.best_t is not null and x.week >= date '2026-10-12'
  ) b order by b.t, b.at limit 1
$$;

-- 0030's ghost_submit(), except an old-physics best no longer blocks a new one.
create or replace function public.ghost_submit(t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.ghost_runs;
  best jsonb;
  my_pi int;
  kept numeric;
  their numeric;
  won boolean;
begin
  if me is null then
    raise exception 'sign in to race ghosts' using errcode = 'insufficient_privilege';
  end if;
  if t is null or t <= 0 or t > 120 then
    raise exception 'bad time' using errcode = 'check_violation';
  end if;
  select * into r from public.ghost_runs where owner_id = me for update;
  if r.started_at is null or now() - r.started_at < make_interval(secs => t::double precision) or now() - r.started_at > interval '3 minutes' then
    raise exception 'no run to finish' using errcode = 'check_violation';
  end if;
  select g.best_car into best from public.game_saves g where g.owner_id = me;
  my_pi := (best ->> 'pi')::int;
  kept := round(greatest(t, public.race_floor(coalesce(my_pi, 0))), 3);
  -- Their ghost as it stood when the run started (my own new best can't change theirs).
  their := public.ghost_target(r.vs);
  won := their is not null and kept < their;
  update public.ghost_runs set
    best_t = case when best_t is null or set_at < timestamptz '2026-10-12 00:00+00' or kept < best_t then kept else best_t end,
    pi = case when best_t is null or set_at < timestamptz '2026-10-12 00:00+00' or kept < best_t then my_pi else pi end,
    car = case when best_t is null or set_at < timestamptz '2026-10-12 00:00+00' or kept < best_t then left(best ->> 'name', 40) else car end,
    set_at = case when best_t is null or set_at < timestamptz '2026-10-12 00:00+00' or kept < best_t then now() else set_at end,
    started_at = null, vs = null,
    last_vs = r.vs, last_t = kept, last_their = their, last_won = won, last_at = now(), taunted = false
  where owner_id = me;
  return jsonb_build_object('kept', kept, 'their', their, 'won', won,
    'best', (select b.t from public.ghost_best(me) b));
end $$;
