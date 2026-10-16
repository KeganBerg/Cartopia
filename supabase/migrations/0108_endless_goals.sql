-- 0108 Endless goals (2026-10-16; thread "Endless generated goals", PR #582; reviewed and rebuilt on the live
-- guard by "Cheat-proof economy"). Generated goals that never run out (src/game/endless.ts).
--  1. econ_private.endless_pay(): what each endless goal pays. ENDLESS_PAY in src/game/endless.ts must match
--     (endless.test.ts checks). 1 gem every 10th until gems x10 (0109) makes it 10.
--  2. econ_guard(): live 16ae57a8 with one more block, after the daily and weekly tasks, crew chests and
--     visitors, that pays endless goals by count: at most 12 a UTC day, level clamped like tasks.
-- RUN ORDER: BEFORE the endless-goals game update ships (a guard without it trims their coins). A save
-- without `endless` is left alone, so it's safe to run early.
create or replace function econ_private.endless_pay() returns jsonb
language sql immutable set search_path = '' as $endless$
  select '{"coins":200,"coinsPerLevel":60,"xp":25,"xpPerLevel":6,"parts":5,"partsEvery":5,"bucks":1,"bucksEvery":10,"perDay":12}'::jsonb
$endless$;
-- The guard runs as the player, so players may read it (it's only these numbers).
revoke all on function econ_private.endless_pay() from public;
grant execute on function econ_private.endless_pay() to authenticated, anon;

CREATE OR REPLACE FUNCTION public.econ_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  cat jsonb := public.econ_catalog();
  player boolean := current_user in ('authenticated', 'anon');
  now_s numeric := extract(epoch from now());
  o jsonb;
  s jsonb := new.state;
  e jsonb;
  fixes jsonb := '{}';
  dt numeric;
  o_lvl int;
  n_lvl int;
  g_lvl int;
  lvl_rate numeric;
  xp_bank numeric;
  val_bank numeric;
  win_bank numeric;
  trophy_bank numeric;
  o_total numeric;
  n_total numeric;
  gain numeric;
  allow numeric;
  excess numeric;
  take numeric;
  r record;
  c jsonb;
  cars jsonb;
  o_uids text[];
  o_claimed jsonb;
  claimed jsonb;
  new_goals text[];
  goal_coins numeric := 0;
  goal_xp numeric := 0;
  goal_bucks numeric := 0;
  daily_coins numeric := 0;
  daily_bucks numeric := 0;
  od text;
  nd text;
  streak int;
  levelup_coins numeric := 0;
  gp_series text;
  gp_box jsonb;
  gp_value numeric := 0;
  o_camp jsonb;
  camp jsonb;
  camp_coins numeric := 0;
  camp_bucks numeric := 0;
  camp_trophies numeric := 0;
  o_sets jsonb;
  new_sets text[];
  asked_sets int;
  set_coins numeric := 0;
  set_bucks numeric := 0;
  set_trophies numeric := 0;
  set_xp numeric := 0;
  restored text;
  restored2 text; -- the car leaving bay 2
  out_car text;
  bk text;
  restore_value numeric := 0;
  bucks_cost numeric := 0;
  max_bucks numeric;
  cap numeric;
  o_value numeric;
  limit_value numeric;
  n_xp numeric;
  fld text;
  inc_coins numeric;
  inc_xp numeric;
  up_xp numeric := 0;
  mod_xp numeric := 0;
  r2 record;
  o_q jsonb;
  s_q jsonb;
  qc jsonb;
  q_lvl int;
  q_key text;
  q_okey text;
  q_same boolean;
  q_n int;
  q_on int;
  q_coins numeric := 0;
  q_xp numeric := 0;
  q_parts numeric := 0;
  q_bucks numeric := 0;
  en_o jsonb;
  en_s jsonb;
  en_pay jsonb;
  en_day text;
  en_oday text;
  en_n int;
  en_on int;
  en_t int;
  en_ot int;
  en_lvl int;
  pur_o int;
  pur_n int;
  pur_p jsonb;
  pay_bucks numeric := 0;
  pay_coins numeric := 0;
  pay_parts numeric := 0;
  per record;
  sc jsonb;
  sea_n int;
  sea_earn numeric := 0;
  sea_same boolean;
  o_sea jsonb;
  s_sea jsonb;
  sea_stars numeric;
  o_tiers jsonb;
  new_tiers int[];
  sea_coins numeric := 0;
  sea_parts numeric := 0;
  sea_bucks numeric := 0;
  sea_car text;
  sea_car_uid text;
  sea_value numeric := 0;
  owed numeric;
  rc jsonb;
  spent numeric;
  d_day text;
  d_old jsonb;
  d_ids text[];
  d_n bigint;
  deal_save numeric := 0;
  o_tr jsonb;
  tr jsonb;
  tr_place int;
  tr_prize jsonb;
  tr_coins numeric := 0;
  tr_bucks numeric := 0;
  tr_trophies numeric := 0;
  cc_o numeric;
  cc_n numeric;
  cc_max numeric;
  cc_lvl int;
  ccp jsonb;
  v_o numeric;
  v_n numeric;
  v_max numeric;
  vp jsonb;
  o_riv jsonb;
  riv jsonb;
  rb_o numeric;
  rb_n numeric;
  rb_sent numeric;
  gp_free boolean := false;
  lock_price numeric;
  lock_bucks numeric;
  cr_o int;
  cr_n int;
  cr_p jsonb;
  cr_uids text[] := '{}';
  cr_mods jsonb := '[]';
  cr_net numeric := 0;
  cr_bucks numeric := 0;
  o_mas jsonb;
  mas jsonb;
  mo jsonb;
  mt jsonb;
  m_races numeric;
  m_wins numeric;
  m_modes jsonb;
  m_upsets numeric;
  m_old int;
  m_tier int;
  m_ok int;
  ms_wins numeric := 0;
  ms_bucks numeric := 0;
  ms_trophies numeric := 0;
  rd_o numeric;
  rd_n numeric;
  rd_max numeric;
  rd_i int;
  rd_p jsonb;
  rd_coins numeric := 0;
  rd_parts numeric := 0;
begin
  -- Columns only the server writes.
  new.corrections := null;
  if tg_op = 'UPDATE' then
    new.previous_state := old.previous_state;
    new.previous_updated_at := old.previous_updated_at;
  else
    new.previous_state := null;
    new.previous_updated_at := null;
  end if;

  if jsonb_typeof(s) <> 'object' then
    raise exception 'save must be an object' using errcode = 'check_violation';
  end if;

  if not player then
    -- Trusted write (SQL editor, service role): keep it as is and start the banks full.
    new.econ := jsonb_build_object('at', now_s);
  else
    if tg_op = 'UPDATE' then
      o := old.state;
      e := coalesce(old.econ, '{}');
      dt := greatest(now_s - coalesce((e ->> 'at')::numeric, now_s), 0);
    else
      -- First cloud save: measured from a fresh town, with an hour of guest play allowed
      -- on top of the time since the account was made (up to a day).
      o := public.econ_starter();
      e := '{}';
      dt := 3600 + least(econ_private.econ_account_age(new.owner_id), 86400);
    end if;

    o_lvl := least(greatest(floor(public.econ_num(o, 'level')), 1), 200)::int;
    lvl_rate := greatest(public.econ_xp_to_next(o_lvl), 400);
    -- Upgraded buildings earn faster, so the banks refill faster (per minute, over level 1).
    select u.coins, u.xp into inc_coins, inc_xp from public.econ_upgrade_rate(o, cat) u;
    if tg_op = 'UPDATE' then
      -- Banks refill with time. A missing bank (a save from before this guard) starts full.
      xp_bank := least(coalesce((e ->> 'xp')::numeric, 1e15) + dt * (lvl_rate / 1200 + inc_xp / 60), 3 * lvl_rate + 60 * inc_xp);
      val_bank := least(coalesce((e ->> 'value')::numeric, 1e15) + dt * (500 + 200 * o_lvl + inc_coins) / 60, 30 * (500 + 200 * o_lvl + inc_coins));
      win_bank := least(coalesce((e ->> 'wins')::numeric, 1e15) + dt / 20, 30);
      trophy_bank := least(coalesce((e ->> 'trophies')::numeric, 1e15) + dt / 20, 40);
    else
      xp_bank := dt * (lvl_rate / 1200 + inc_xp / 60);
      val_bank := dt * (500 + 200 * o_lvl + inc_coins) / 60;
      win_bank := dt / 20;
      trophy_bank := dt / 20;
    end if;

    -- Fields of the wrong type keep their last good value.
    for fld in select unnest(array['level', 'xp', 'coins', 'bucks', 'parts', 'fuel', 'trophies', 'racesWon', 'dailyStreak']) loop
      if jsonb_typeof(s -> fld) is distinct from 'number' then
        s := jsonb_set(s, array[fld], coalesce(case when jsonb_typeof(o -> fld) = 'number' then o -> fld end, '0'));
        fixes := fixes || jsonb_build_object(fld, 'not a number');
      end if;
    end loop;
    for fld in select unnest(array['cars', 'buildings', 'roads', 'land', 'claimedGoals', 'junkyard']) loop
      if jsonb_typeof(s -> fld) is distinct from 'array' then
        s := jsonb_set(s, array[fld], coalesce(case when jsonb_typeof(o -> fld) = 'array' then o -> fld end, '[]'));
        fixes := fixes || jsonb_build_object(fld, 'not a list');
      end if;
    end loop;

    -- Cars: upgrades stay within 0-5. Models the catalog doesn't know yet are kept but count for nothing.
    cars := '[]';
    for c in select x from jsonb_array_elements(case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end) x loop
      if jsonb_typeof(c) = 'object' and c ->> 'uid' is not null then
        cars := cars || jsonb_build_array(c || jsonb_build_object('upgrades', jsonb_build_object(
          'engine', public.econ_upgrade(c, 'engine'), 'turbo', public.econ_upgrade(c, 'turbo'),
          'tires', public.econ_upgrade(c, 'tires'), 'weight', public.econ_upgrade(c, 'weight'))));
      end if;
    end loop;
    if cars is distinct from s -> 'cars' then
      fixes := fixes || '{"cars":"bad cars or upgrades"}';
    end if;
    s := jsonb_set(s, '{cars}', cars);
    select coalesce(array_agg(x ->> 'uid'), '{}') into o_uids
      from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) x;

    -- Goals stay claimed; newly claimed ones pay their listed reward once.
    o_claimed := case when jsonb_typeof(o -> 'claimedGoals') = 'array' then o -> 'claimedGoals' else '[]' end;
    select coalesce(array_agg(distinct g), '{}') into new_goals
      from jsonb_array_elements_text(case when jsonb_typeof(s -> 'claimedGoals') = 'array' then s -> 'claimedGoals' else '[]' end) g
      where not o_claimed ? g;
    claimed := o_claimed || coalesce(to_jsonb(new_goals), '[]');
    if exists (select 1 from jsonb_array_elements_text(o_claimed) g
               where not coalesce(case when jsonb_typeof(s -> 'claimedGoals') = 'array' then s -> 'claimedGoals' end, '[]') ? g) then
      fixes := fixes || '{"claimedGoals":"kept claimed goals"}';
    end if;
    s := jsonb_set(s, '{claimedGoals}', claimed);
    select coalesce(sum((cat -> 'goals' -> g ->> 'coins')::numeric), 0), coalesce(sum((cat -> 'goals' -> g ->> 'xp')::numeric), 0),
           coalesce(sum((cat -> 'goals' -> g ->> 'bucks')::numeric), 0)
      into goal_coins, goal_xp, goal_bucks from unnest(new_goals) g;

    -- Collection book: claimed sets stay claimed. A newly claimed set pays its listed coins, bucks,
    -- trophies and XP once, if every car in it is owned (in this save or the last one). Claims for
    -- sets this catalog doesn't know, or that aren't complete, are dropped so they can be claimed later.
    -- (A save with no claimedSets is from a client older than the book, so the old list comes back quietly.)
    o_sets := case when jsonb_typeof(o -> 'claimedSets') = 'array' then o -> 'claimedSets' else '[]' end;
    select coalesce(array_agg(distinct g), '{}') into new_sets
      from jsonb_array_elements_text(case when jsonb_typeof(s -> 'claimedSets') = 'array' then s -> 'claimedSets' else '[]' end) g
      where not o_sets ? g;
    asked_sets := cardinality(new_sets);
    select coalesce(array_agg(g), '{}') into new_sets from unnest(new_sets) g
      where coalesce(cat -> 'sets', '{}') ? g
        and not exists (
          select 1 from jsonb_array_elements_text(cat -> 'sets' -> g -> 'cars') m
          where not exists (select 1 from jsonb_array_elements(cars) x where x ->> 'model' = m)
            and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) x
                            where x ->> 'model' = m));
    if cardinality(new_sets) < asked_sets then
      fixes := fixes || '{"sets":"set not complete"}';
    end if;
    if jsonb_typeof(s -> 'claimedSets') = 'array'
       and exists (select 1 from jsonb_array_elements_text(o_sets) g where not (s -> 'claimedSets') ? g) then
      fixes := fixes || '{"claimedSets":"kept claimed sets"}';
    end if;
    s := jsonb_set(s, '{claimedSets}', o_sets || coalesce(to_jsonb(new_sets), '[]'));
    select coalesce(sum((cat -> 'sets' -> g ->> 'coins')::numeric), 0), coalesce(sum((cat -> 'sets' -> g ->> 'bucks')::numeric), 0),
           coalesce(sum((cat -> 'sets' -> g ->> 'trophies')::numeric), 0), coalesce(sum((cat -> 'sets' -> g ->> 'xp')::numeric), 0)
      into set_coins, set_bucks, set_trophies, set_xp from unnest(new_sets) g;
    goal_xp := goal_xp + set_xp;

    -- Daily and weekly tasks: each UTC day and each ISO week pays at most `count` task rewards, plus one
    -- chest once all of them are collected. Rewards scale with level. A period can only move forward
    -- (to tomorrow at most, for clocks ahead of UTC), and collected tasks and opened chests stay that way.
    -- A save without tasks (a client older than them) keeps the saved ones.
    o_q := case when jsonb_typeof(o -> 'quests') = 'object' then o -> 'quests' else '{}' end;
    if jsonb_typeof(s -> 'quests') is distinct from 'object' then
      if o_q <> '{}' then s := jsonb_set(s, '{quests}', o_q); end if;
    else
      s_q := s -> 'quests';
      q_lvl := least(greatest(floor(public.econ_num(s, 'level'))::int, o_lvl), o_lvl + 2);
      for per in select * from (values
          ('daily', 'day', 'dayDone', 'dayChest', '^\d{4}-\d{2}-\d{2}$', to_char((now() at time zone 'utc') + interval '1 day', 'YYYY-MM-DD')),
          ('weekly', 'week', 'weekDone', 'weekChest', '^\d{4}-W\d{2}$', to_char((now() at time zone 'utc') + interval '1 day', 'IYYY-"W"IW'))
        ) v(cat_key, k, done, chest, pat, max_key) loop
        qc := cat -> 'quests' -> per.cat_key;
        q_key := s_q ->> per.k;
        q_okey := o_q ->> per.k;
        q_same := q_key is not distinct from q_okey;
        q_n := case when jsonb_typeof(s_q -> per.done) = 'array' then jsonb_array_length(s_q -> per.done) else 0 end;
        q_on := case when q_same and jsonb_typeof(o_q -> per.done) = 'array' then jsonb_array_length(o_q -> per.done) else 0 end;
        if qc is null or q_key is null or q_key !~ per.pat or q_key > per.max_key or (q_okey is not null and q_key < q_okey) or q_n < q_on then
          -- A bad or backdated period keeps the last saved one.
          if not q_same or q_n <> q_on or (s_q -> per.chest) is distinct from (o_q -> per.chest) then
            s_q := s_q || jsonb_build_object(per.k, o_q -> per.k, per.done, coalesce(o_q -> per.done, '[]'), per.chest, coalesce(o_q -> per.chest, 'false'));
            fixes := fixes || jsonb_build_object(per.k, 'kept saved tasks');
          end if;
        else
          q_n := least(q_n, (qc ->> 'count')::int);
          q_on := least(q_on, (qc ->> 'count')::int);
          q_coins := q_coins + (q_n - q_on) * ((qc -> 'task' ->> 'coins')::numeric + (qc -> 'task' ->> 'coinsPerLevel')::numeric * q_lvl);
          sea_earn := sea_earn + greatest(q_n - q_on, 0) * coalesce((cat -> 'season' -> 'stars' ->> (per.cat_key || 'Task'))::numeric, 0);
          q_xp := q_xp + (q_n - q_on) * ((qc -> 'task' ->> 'xp')::numeric + (qc -> 'task' ->> 'xpPerLevel')::numeric * q_lvl);
          if q_same and o_q -> per.chest = 'true'::jsonb then
            if s_q -> per.chest is distinct from 'true'::jsonb then
              s_q := jsonb_set(s_q, array[per.chest], 'true');
            end if;
          elsif s_q -> per.chest = 'true'::jsonb then
            if q_n >= (qc ->> 'count')::int then
              q_coins := q_coins + (qc -> 'chest' ->> 'coins')::numeric + (qc -> 'chest' ->> 'coinsPerLevel')::numeric * q_lvl;
              q_xp := q_xp + (qc -> 'chest' ->> 'xp')::numeric + (qc -> 'chest' ->> 'xpPerLevel')::numeric * q_lvl;
              q_parts := q_parts + (qc -> 'chest' ->> 'parts')::numeric;
              q_bucks := q_bucks + (qc -> 'chest' ->> 'bucks')::numeric;
              sea_earn := sea_earn + coalesce((cat -> 'season' -> 'stars' ->> (per.cat_key || 'Chest'))::numeric, 0);
            else
              s_q := jsonb_set(s_q, array[per.chest], 'false');
              fixes := fixes || jsonb_build_object(per.chest, 'tasks not done');
            end if;
          end if;
        end if;
      end loop;
      s := jsonb_set(s, '{quests}', s_q);
    end if;
    -- Crew chests: `crewChests` counts the crew chests this save has opened. Each one needs a row in
    -- public.crew_chests (open_crew_chest writes it after checking the crew's weekly goal) and pays
    -- catalog crew.chest at the player's level. The count never goes down; a save without it keeps the old one.
    cc_o := greatest(floor(public.econ_num(o, 'crewChests')), 0);
    if jsonb_typeof(s -> 'crewChests') is distinct from 'number' then
      if o ? 'crewChests' then s := jsonb_set(s, '{crewChests}', to_jsonb(cc_o)); end if;
    else
      cc_n := floor(public.econ_num(s, 'crewChests'));
      -- (Until crew_weekly_goal.sql has run there's no table, so no new chests.)
      cc_max := cc_o;
      if to_regclass('public.crew_chests') is not null then
        cc_max := greatest((select count(*) from public.crew_chests where owner_id = new.owner_id), cc_o);
      end if;
      if cc_n < cc_o or cc_n > cc_max then
        fixes := fixes || jsonb_build_object('crewChests', jsonb_build_object('sent', cc_n, 'kept', least(greatest(cc_n, cc_o), cc_max)));
        cc_n := least(greatest(cc_n, cc_o), cc_max);
        s := jsonb_set(s, '{crewChests}', to_jsonb(cc_n));
      end if;
      ccp := cat -> 'crew' -> 'chest';
      if cc_n > cc_o and ccp is not null then
        cc_lvl := least(greatest(floor(public.econ_num(s, 'level'))::int, o_lvl), o_lvl + 2);
        q_coins := q_coins + (cc_n - cc_o) * ((ccp ->> 'coins')::numeric + (ccp ->> 'coinsPerLevel')::numeric * cc_lvl);
        q_xp := q_xp + (cc_n - cc_o) * ((ccp ->> 'xp')::numeric + (ccp ->> 'xpPerLevel')::numeric * cc_lvl);
        q_parts := q_parts + (cc_n - cc_o) * (ccp ->> 'parts')::numeric;
        q_bucks := q_bucks + (cc_n - cc_o) * (ccp ->> 'bucks')::numeric;
      end if;
    end if;
    -- Town visitors: `visits` is the claim number (visitor_claim() in town_visitors.sql) of the latest
    -- visitor prize this save collected. Each claim it newly counts pays that claim's prize, from
    -- econ_private.visit_pay(). It never goes down or past the claims made; a save without it keeps the old one.
    v_o := greatest(floor(public.econ_num(o, 'visits')), 0);
    if jsonb_typeof(s -> 'visits') is distinct from 'number' then
      if o ? 'visits' then s := jsonb_set(s, '{visits}', to_jsonb(v_o)); end if;
    else
      v_n := floor(public.econ_num(s, 'visits'));
      -- (Until town_visitors.sql has run there are no claims.)
      v_max := v_o;
      if to_regprocedure('econ_private.visit_pay(integer,integer)') is not null then
        v_max := greatest((econ_private.visit_pay(0, 0) ->> 'n')::numeric, v_o);
      end if;
      if v_n < v_o or v_n > v_max then
        fixes := fixes || jsonb_build_object('visits', jsonb_build_object('sent', v_n, 'kept', least(greatest(v_n, v_o), v_max)));
        v_n := least(greatest(v_n, v_o), v_max);
        s := jsonb_set(s, '{visits}', to_jsonb(v_n));
      end if;
      if v_n > v_o then
        vp := econ_private.visit_pay(v_o::int, v_n::int);
        q_coins := q_coins + (vp ->> 'coins')::numeric;
        q_xp := q_xp + (vp ->> 'xp')::numeric;
        q_parts := q_parts + (vp ->> 'parts')::numeric;
        q_bucks := q_bucks + (vp ->> 'bucks')::numeric;
      end if;
    end if;
    -- Endless goals (0108): `endless` is {day, today, n, goals}. n counts the endless goals this town has
    -- collected and today those collected on `day` (UTC). Each one newly counted pays
    -- econ_private.endless_pay() at the save's level: coins and XP, parts every partsEvery-th and gems
    -- every bucksEvery-th. At most perDay a day; n and today only go up within a day, the day only moves
    -- forward (to tomorrow at most), and a new day may also carry the last day's unsaved ones (up to that day's perDay).
    -- A save without it (a client older than endless goals) keeps the saved one.
    en_o := case when jsonb_typeof(o -> 'endless') = 'object' then o -> 'endless' else '{}' end;
    if jsonb_typeof(s -> 'endless') is distinct from 'object' then
      if en_o <> '{}' then s := jsonb_set(s, '{endless}', en_o); end if;
    elsif to_regprocedure('econ_private.endless_pay()') is not null then
      en_s := s -> 'endless';
      en_pay := econ_private.endless_pay();
      en_day := en_s ->> 'day';
      en_oday := nullif(en_o ->> 'day', '');
      en_n := floor(public.econ_num(en_s, 'n'))::int;
      en_on := greatest(floor(public.econ_num(en_o, 'n')), 0)::int;
      en_t := floor(public.econ_num(en_s, 'today'))::int;
      en_ot := case when en_day is not distinct from en_oday then greatest(floor(public.econ_num(en_o, 'today')), 0)::int else 0 end;
      if en_n = en_on and en_day is not distinct from (en_o ->> 'day') and en_t = floor(public.econ_num(en_o, 'today')) then
        null; -- nothing collected
      elsif en_day is null or en_day !~ '^\d{4}-\d{2}-\d{2}$' or en_day > to_char((now() at time zone 'utc') + interval '1 day', 'YYYY-MM-DD')
         or (en_oday is not null and en_day < en_oday) or en_n < en_on or en_t < en_ot or en_t > (en_pay ->> 'perDay')::int
         or en_n - en_on > en_t - en_ot + (case when en_day is distinct from en_oday then greatest((en_pay ->> 'perDay')::int - floor(public.econ_num(en_o, 'today'))::int, 0) else 0 end) then
        -- A bad count or day keeps the saved count and day (the goals on the board stay as sent).
        s := jsonb_set(s, '{endless}', en_s || jsonb_build_object('n', en_on, 'day', coalesce(en_o -> 'day', '""'), 'today', coalesce(en_o -> 'today', '0')));
        fixes := fixes || '{"endless":"kept saved endless goals"}';
      else
        en_lvl := least(greatest(floor(public.econ_num(s, 'level'))::int, o_lvl), o_lvl + 2);
        for k in en_on + 1 .. en_n loop
          q_coins := q_coins + (en_pay ->> 'coins')::numeric + (en_pay ->> 'coinsPerLevel')::numeric * en_lvl;
          q_xp := q_xp + (en_pay ->> 'xp')::numeric + (en_pay ->> 'xpPerLevel')::numeric * en_lvl;
          if k % (en_pay ->> 'partsEvery')::int = 0 then q_parts := q_parts + (en_pay ->> 'parts')::numeric; end if;
          if k % (en_pay ->> 'bucksEvery')::int = 0 then q_bucks := q_bucks + (en_pay ->> 'bucks')::numeric; end if;
        end loop;
      end if;
    end if;
    goal_xp := goal_xp + q_xp;

    -- Gem packs (0078): `purchases` is the seq of the last paid pack (public.purchases, written by the
    -- Stripe webhook through purchase_record()) this save added. It never goes down or past the packs
    -- paid, and packs it newly counts pay their gems, coins and parts. A town started after a reset
    -- begins after the packs bought before the reset, so a reset never pays a pack twice.
    pur_o := greatest(floor(public.econ_num(o, 'purchases')), 0)::int;
    if jsonb_typeof(s -> 'purchases') = 'number' or o ? 'purchases' or tg_op = 'INSERT' then
      pur_p := econ_private.purchase_pay(pur_o, pur_o);
      if tg_op = 'INSERT' then pur_o := greatest(pur_o, (pur_p ->> 'reset')::int); end if;
      pur_n := least(greatest(floor(public.econ_num(s, 'purchases'))::int, pur_o), greatest((pur_p ->> 'n')::int, pur_o));
      if s ? 'purchases' and pur_n is distinct from public.econ_num(s, 'purchases') then
        fixes := fixes || jsonb_build_object('purchases', jsonb_build_object('sent', s -> 'purchases', 'kept', pur_n));
      end if;
      if pur_n > 0 or s ? 'purchases' or o ? 'purchases' then
        s := jsonb_set(s, '{purchases}', to_jsonb(pur_n));
      end if;
      if pur_n > pur_o then
        pur_p := econ_private.purchase_pay(pur_o, pur_n);
        pay_bucks := (pur_p ->> 'bucks')::numeric;
        pay_coins := (pur_p ->> 'coins')::numeric;
        pay_parts := (pur_p ->> 'parts')::numeric;
      end if;
    end if;

    -- Season track: stars come only from the task rewards and chests collected in this save (counted
    -- above), and a new season starts from zero. A newly collected tier must have its stars and pays
    -- its prize once. The last tier gives the season's car, the only way to get one (or bucks when the
    -- season has no car). A save without a season (a client older than it) keeps the saved one.
    sc := cat -> 'season';
    o_sea := case when jsonb_typeof(o -> 'season') = 'object' then o -> 'season' else '{}' end;
    if sc is not null then
      sea_n := greatest(floor((now_s - extract(epoch from (sc ->> 'start')::date)) / ((sc ->> 'days')::numeric * 86400)) + 1, 1)::int;
      if jsonb_typeof(s -> 'season') is distinct from 'object' and sea_earn = 0 then
        if o_sea <> '{}' then s := jsonb_set(s, '{season}', o_sea); end if;
      else
        -- (A page from before the season track sends no season: it gets the stars it earned.)
        s_sea := case when jsonb_typeof(s -> 'season') = 'object' then s -> 'season'
                      when public.econ_num(o_sea, 'n') = sea_n then o_sea || jsonb_build_object('stars', public.econ_num(o_sea, 'stars') + sea_earn)
                      else jsonb_build_object('n', sea_n, 'stars', sea_earn, 'claimed', '[]'::jsonb) end;
        sea_same := public.econ_num(o_sea, 'n') = sea_n;
        sea_stars := least(greatest(floor(public.econ_num(s_sea, 'stars')), 0),
                           case when sea_same then public.econ_num(o_sea, 'stars') else 0 end + sea_earn);
        o_tiers := case when sea_same and jsonb_typeof(o_sea -> 'claimed') = 'array' then o_sea -> 'claimed' else '[]' end;
        select coalesce(array_agg(distinct t), '{}') into new_tiers from (
          select (x #>> '{}')::int t from jsonb_array_elements(case when jsonb_typeof(s_sea -> 'claimed') = 'array' then s_sea -> 'claimed' else '[]' end) x
          where jsonb_typeof(x) = 'number' and (x #>> '{}') ~ '^\d+$') q
          where t < jsonb_array_length(sc -> 'tiers') and not o_tiers @> to_jsonb(t) and (t + 1) * (sc ->> 'perTier')::numeric <= sea_stars;
        select coalesce(sum((sc -> 'tiers' -> t ->> 'coins')::numeric), 0), coalesce(sum((sc -> 'tiers' -> t ->> 'parts')::numeric), 0),
               coalesce(sum((sc -> 'tiers' -> t ->> 'bucks')::numeric), 0)
          into sea_coins, sea_parts, sea_bucks from unnest(new_tiers) t;
        if exists (select 1 from unnest(new_tiers) t where (sc -> 'tiers' -> t ->> 'car')::boolean) then
          sea_car := sc -> 'cars' ->> sea_n::text;
          if sea_car is null then sea_bucks := sea_bucks + (sc ->> 'carBucks')::numeric; end if;
        end if;
        if public.econ_num(s_sea, 'n') <> sea_n or public.econ_num(s_sea, 'stars') <> sea_stars
           or jsonb_array_length(case when jsonb_typeof(s_sea -> 'claimed') = 'array' then s_sea -> 'claimed' else '[]' end)
              <> jsonb_array_length(o_tiers) + cardinality(new_tiers) then
          fixes := fixes || jsonb_build_object('season', jsonb_build_object('stars', sea_stars));
        end if;
        s := jsonb_set(s, '{season}', jsonb_build_object('n', sea_n, 'stars', sea_stars,
          'claimed', o_tiers || coalesce((select jsonb_agg(t order by t) from unnest(new_tiers) t), '[]')));
      end if;
      -- New season cars: only this season's, one, and only with its tier collected in this save.
      for r in select x from jsonb_array_elements(cars) x
               where not (x ->> 'uid') = any(o_uids)
                 and exists (select 1 from jsonb_each_text(coalesce(sc -> 'cars', '{}')) k where k.value = x ->> 'model') loop
        if sea_car_uid is null and r.x ->> 'model' = sea_car then
          sea_car_uid := r.x ->> 'uid';
          sea_value := (cat -> 'cars' -> sea_car ->> 'price')::numeric;
        else
          cars := (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(cars) y where y ->> 'uid' <> r.x ->> 'uid');
          fixes := fixes || jsonb_build_object('season_car', r.x ->> 'model');
        end if;
      end loop;
      s := jsonb_set(s, '{cars}', cars);
    end if;

    -- Building upgrades pay their listed XP once per level gained (the coins are checked with town worth).
    select coalesce(sum(greatest((cat -> 'upgradeXpTo' ->> (public.econ_blvl(x) - 1))::numeric
                                 - (cat -> 'upgradeXpTo' ->> (public.econ_old_blvl(o, x) - 1))::numeric, 0)), 0)
      into up_xp
      from jsonb_array_elements(case when jsonb_typeof(s -> 'buildings') = 'array' then s -> 'buildings' else '[]' end) x
      where cat -> 'buildings' -> (x ->> 'def') ? 'up';
    -- Newly bought car mods pay their listed XP once each.
    select coalesce(sum((cat -> 'mods' -> f.id ->> 'xp')::numeric), 0) into mod_xp
      from jsonb_array_elements(cars) x, public.econ_owned_mods(x, cat) f
      where not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) z,
                               public.econ_owned_mods(z, cat) g
                        where z ->> 'uid' = x ->> 'uid' and g.id = f.id);
    goal_xp := goal_xp + up_xp + mod_xp;

    -- XP and level.
    o_total := public.econ_total_xp(o_lvl, public.econ_num(o, 'xp'));
    n_total := public.econ_total_xp(least(greatest(floor(public.econ_num(s, 'level')), 1), 200)::int, public.econ_num(s, 'xp'));
    gain := n_total - o_total;
    if gain > xp_bank + goal_xp then
      fixes := fixes || jsonb_build_object('xp', jsonb_build_object('sent', gain, 'kept', floor(xp_bank + goal_xp)));
      n_total := o_total + floor(xp_bank + goal_xp);
      xp_bank := 0;
    else
      xp_bank := xp_bank - greatest(gain - goal_xp, 0);
    end if;
    select l.lvl, l.xp into n_lvl, n_xp from public.econ_level_for(n_total) l;
    -- Never below the level already saved (the save guard refuses level drops).
    if n_lvl < o_lvl then
      n_lvl := o_lvl;
      n_xp := greatest(public.econ_num(s, 'xp'), 0);
    end if;
    s := s || jsonb_build_object('level', n_lvl, 'xp', n_xp);
    -- The level locks below (race series, campaign, rivals, Rusty's finds, cars) read g_lvl: the
    -- player's level, or past every lock for an admin saving their own town (0099). is_admin() is
    -- only asked for signed-in players (anon can't run it).
    g_lvl := n_lvl;
    if current_user = 'authenticated' then
      if new.owner_id = auth.uid() and public.is_admin() then g_lvl := 999; end if;
    end if;
    select coalesce(sum(l * 100), 0) into levelup_coins from generate_series(o_lvl + 1, n_lvl) l;

    -- Daily check-in (0069): once per UTC day, one day along whether or not yesterday was
    -- collected; dailyStreak counts days collected and the calendar loops after day 5.
    od := o ->> 'lastDaily';
    nd := s ->> 'lastDaily';
    if nd is distinct from od then
      if nd ~ '^\d{4}-\d{2}-\d{2}$' and (od is null or nd > od) and nd::date <= (now() at time zone 'utc')::date + 1 then
        streak := greatest(floor(public.econ_num(o, 'dailyStreak'))::int, 0) + 1;
        if public.econ_num(s, 'dailyStreak') > streak then
          s := jsonb_set(s, '{dailyStreak}', to_jsonb(streak));
          fixes := fixes || '{"dailyStreak":"too long"}';
        end if;
        streak := mod(greatest(floor(public.econ_num(s, 'dailyStreak'))::int, 1) - 1, 5) + 1;
        daily_coins := (array[200, 400, 600, 800 + 5 * 50, 1200])[streak];
        daily_bucks := case when streak = 5 then 1 else 0 end;
      else
        s := s || jsonb_build_object('lastDaily', o -> 'lastDaily', 'dailyStreak', coalesce(o -> 'dailyStreak', '0'));
        fixes := fixes || '{"lastDaily":"already claimed"}';
      end if;
    end if;

    -- A finished Grand Prix series pays a mystery box car and 5 trophies, at most once every two minutes.
    if g_lvl >= 2 and now_s - coalesce((e ->> 'gp_at')::numeric, 0) >= 120 then
      select k into gp_series from jsonb_each(cat -> 'gp') g(k, v)
        where g_lvl >= (v ->> 'unlock')::int
          and public.econ_num(s -> 'gp' -> k, 'clears') > public.econ_num(o -> 'gp' -> k, 'clears')
        limit 1;
      if gp_series is not null then
        gp_box := cat -> 'gp' -> gp_series -> 'box';
        select max((cat -> 'cars' -> b ->> 'price')::numeric) into gp_value from jsonb_array_elements_text(gp_box) b;
        e := e || jsonb_build_object('gp_at', now_s);
      end if;
    end if;

    -- Campaign: races stay won with their best stars (whole numbers 1-3). Each chapter pays its clear
    -- bonus (coins, bucks, trophies) once when its last race is first won, and its star bucks once
    -- when every race in it has three stars. Chapters above the player's level pay nothing.
    o_camp := case when jsonb_typeof(o -> 'campaign') = 'object' then o -> 'campaign' else '{}' end;
    -- (A save with no campaign at all is from a client older than it, so the wins come back quietly.)
    if jsonb_typeof(s -> 'campaign') = 'object'
       and exists (select 1 from jsonb_each(o_camp) x where public.econ_num(s -> 'campaign', x.key) < public.econ_num(o_camp, x.key)) then
      fixes := fixes || '{"campaign":"kept races won"}';
    end if;
    select coalesce(jsonb_object_agg(k, n), '{}') into camp from (
      select k, max(n)::int n from (
        select x.key k, least(floor(public.econ_num(s -> 'campaign', x.key)), 3) n
          from jsonb_each(case when jsonb_typeof(s -> 'campaign') = 'object' then s -> 'campaign' else '{}' end) x
        union all
        select x.key, least(floor(public.econ_num(o_camp, x.key)), 3) from jsonb_each(o_camp) x
      ) t where n >= 1 group by k) q;
    s := jsonb_set(s, '{campaign}', camp);
    for r in select v, (select min(public.econ_num(o_camp, x)) from jsonb_array_elements_text(v -> 'races') x) o_min,
                       (select min(public.econ_num(camp, x)) from jsonb_array_elements_text(v -> 'races') x) n_min
             from jsonb_each(coalesce(cat -> 'campaign', '{}')) g(k, v) where g_lvl >= (v ->> 'unlock')::int loop
      if r.n_min >= 1 and r.o_min < 1 then
        camp_coins := camp_coins + (r.v ->> 'coins')::numeric;
        camp_bucks := camp_bucks + (r.v ->> 'bucks')::numeric;
        camp_trophies := camp_trophies + (r.v ->> 'trophies')::numeric;
      end if;
      if r.n_min >= 3 and r.o_min < 3 then
        camp_bucks := camp_bucks + (r.v ->> 'starBucks')::numeric;
      end if;
    end loop;

    -- Town rivals: each rival's `beaten` count (0-3) never drops and goes up by at most one per visit
    -- (a beaten rival is back in 30 minutes, so 25 apart by the server clock). Ids the catalog doesn't
    -- know are dropped; `back` (the game's cooldown) passes through. The third win pays the rival's
    -- one-time bonus, if the level has unlocked it. A save with no rivals (an older page) keeps the old.
    o_riv := case when jsonb_typeof(o -> 'rivals') = 'object' then o -> 'rivals' else '{}' end;
    if jsonb_typeof(s -> 'rivals') is distinct from 'object' then
      if o_riv <> '{}' then s := jsonb_set(s, '{rivals}', o_riv); end if;
    else
      riv := '{}';
      for r in select e2.key k, e2.value v from jsonb_each(case when jsonb_typeof(cat -> 'rivals') = 'object' then cat -> 'rivals' else '{}' end) e2 loop
        rb_o := least(greatest(floor(public.econ_num(o_riv -> r.k, 'beaten')), 0), 3);
        rb_sent := least(greatest(floor(public.econ_num(s -> 'rivals' -> r.k, 'beaten')), 0), 3);
        rb_n := rb_sent;
        if rb_n < rb_o then
          rb_n := rb_o;
          fixes := fixes || '{"rivals":"kept rivals beaten"}';
        elsif rb_n > rb_o then
          if now_s - coalesce((e -> 'riv' ->> r.k)::numeric, 0) < 1500 then
            rb_n := rb_o;
          else
            rb_n := rb_o + 1;
            e := jsonb_set(e, '{riv}', coalesce(e -> 'riv', '{}') || jsonb_build_object(r.k, now_s));
          end if;
          if rb_n <> rb_sent then
            fixes := fixes || jsonb_build_object('rivals', jsonb_build_object(r.k, rb_n));
          end if;
        end if;
        if jsonb_typeof(s -> 'rivals' -> r.k) = 'object' or o_riv ? r.k then
          riv := riv || jsonb_build_object(r.k, coalesce(case when jsonb_typeof(s -> 'rivals' -> r.k) = 'object' then s -> 'rivals' -> r.k end,
                                                         case when jsonb_typeof(o_riv -> r.k) = 'object' then o_riv -> r.k end, '{}')
                                                || jsonb_build_object('beaten', rb_n));
        end if;
        if rb_n >= 3 and rb_o < 3 and g_lvl >= (r.v ->> 'unlock')::int then
          camp_coins := camp_coins + (r.v ->> 'coins')::numeric;
          camp_bucks := camp_bucks + (r.v ->> 'bucks')::numeric;
          camp_trophies := camp_trophies + (r.v ->> 'trophies')::numeric;
        end if;
      end loop;
      s := jsonb_set(s, '{rivals}', riv);
    end if;

    -- Daily deals: each UTC day has three, the same for everyone (dealsFor() in data.ts). A deal sells
    -- for less than the worth it adds, so each one newly used today or yesterday allows its `save` once.
    -- The deals day can't go back.
    if jsonb_typeof(s -> 'deals') = 'object' and jsonb_typeof(cat -> 'deals') = 'object' then
      d_day := s -> 'deals' ->> 'day';
      if d_day ~ '^\d{4}-\d{2}-\d{2}$'
         and d_day::date between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date
         and d_day >= coalesce(case when jsonb_typeof(o -> 'deals') = 'object' then o -> 'deals' ->> 'day' end, '') then
        d_old := case when jsonb_typeof(o -> 'deals') = 'object' and o -> 'deals' ->> 'day' = d_day
                        and jsonb_typeof(o -> 'deals' -> 'used') = 'array' then o -> 'deals' -> 'used' else '[]' end;
        d_n := floor(extract(epoch from d_day::date) / 86400)::bigint;
        select coalesce(array_agg(cat -> 'deals' -> 'slots' -> i ->> ((d_n * (cat -> 'deals' -> 'step' ->> i)::bigint + i)
                                     % jsonb_array_length(cat -> 'deals' -> 'slots' -> i))::int), '{}')
          into d_ids from generate_series(0, jsonb_array_length(cat -> 'deals' -> 'slots') - 1) i;
        select coalesce(sum(coalesce((cat -> 'deals' -> 'save' ->> u)::numeric, 0)), 0) into deal_save
          from (select distinct u from jsonb_array_elements_text(case when jsonb_typeof(s -> 'deals' -> 'used') = 'array' then s -> 'deals' -> 'used' else '[]' end) u
                where u = any(d_ids) and not d_old ? u) q;
      end if;
    end if;

    -- Weekly time trials: a week's prize is claimed once, for the place the server has for that
    -- finished week (trial_place(), from time_trials.sql). Claims for weeks with no place are dropped,
    -- and claimed weeks stay claimed.
    o_tr := case when jsonb_typeof(o -> 'trials' -> 'claimed') = 'object' then o -> 'trials' -> 'claimed' else '{}' end;
    if jsonb_typeof(s -> 'trials') = 'object' or o_tr <> '{}' then
      tr := o_tr;
      if jsonb_typeof(s -> 'trials' -> 'claimed') = 'object' then
        for r in select k from jsonb_object_keys(s -> 'trials' -> 'claimed') k where not o_tr ? k loop
          tr_place := null;
          if r.k ~ '^\d{4}-\d{2}-\d{2}$' and to_regprocedure('public.trial_place(uuid,date)') is not null then
            begin
              tr_place := public.trial_place(new.owner_id, r.k::date);
            exception when others then
              tr_place := null;
            end;
          end if;
          if tr_place is null then
            fixes := fixes || jsonb_build_object('trial', r.k);
          else
            tr := tr || jsonb_build_object(r.k, tr_place);
            tr_prize := public.trial_prize(tr_place);
            tr_coins := tr_coins + coalesce((tr_prize ->> 'coins')::numeric, 0);
            tr_bucks := tr_bucks + coalesce((tr_prize ->> 'bucks')::numeric, 0);
            tr_trophies := tr_trophies + coalesce((tr_prize ->> 'trophies')::numeric, 0);
          end if;
        end loop;
      end if;
      if jsonb_typeof(s -> 'trials') = 'object'
         and exists (select 1 from jsonb_object_keys(o_tr) k where not coalesce(s -> 'trials' -> 'claimed', '{}') ? k) then
        fixes := fixes || '{"trials":"kept claimed weeks"}';
      end if;
      s := jsonb_set(s, '{trials}', case when jsonb_typeof(s -> 'trials') = 'object' then s -> 'trials' else '{}' end || jsonb_build_object('claimed', tr));
    end if;

    -- A restored car (the one in the bay, by uid) is worth its price, at most once a minute, less
    -- what the restore and its share of Rusty's search cost (restoreCost() in data.ts, and the cost
    -- rescue_roll() noted on the find). That must already have been spent: worth the town lost since
    -- (econ.spent) pays for it, and the rest comes off the car's allowance. Towns from before this
    -- check start with 50,000 spent, so a restore already paid for isn't charged twice.
    -- Both of Rusty's bays (`restoring`, and `restoring2` once the second bay is open).
    foreach bk in array array['restoring', 'restoring2'] loop
      out_car := null;
      if jsonb_typeof(o -> bk) = 'object' and now_s - coalesce((e ->> (case bk when 'restoring' then 'restore_at' else 'restore2_at' end))::numeric, 0) >= 60
         and g_lvl >= coalesce((cat -> 'rescue' ->> (o -> bk ->> 'model'))::int, 999) then
        select x ->> 'uid' into out_car from jsonb_array_elements(cars) x
          where x ->> 'uid' = o -> bk ->> 'uid' and x ->> 'model' = o -> bk ->> 'model' and not (x ->> 'uid') = any(o_uids)
          limit 1;
        if out_car is not null then
          rc := cat -> 'cars' -> (o -> bk ->> 'model');
          owed := greatest(200, round(((rc ->> 'price')::numeric + coalesce((rc ->> 'bucks')::numeric, 0) * 1000) * 0.25 / 10) * 10)
                + coalesce((select f.cost from econ_private.rescue_find(out_car) f), 0);
          spent := coalesce((e ->> 'spent')::numeric, 50000);
          restore_value := restore_value + greatest((rc ->> 'price')::numeric - greatest(owed - spent, 0), 0);
          if bk = 'restoring' then restored := out_car; else restored2 := out_car; end if;
          e := e || jsonb_build_object(case bk when 'restoring' then 'restore_at' else 'restore2_at' end, now_s, 'spent', greatest(spent - owed, 0));
        end if;
      end if;
    end loop;

    -- Crates: the save counts the opens it has added (`crates`: never less than before, never more
    -- than crate_open() has made). Opens added in this save pay the coins they won and the cars
    -- (at catalog price) and parts they gave, less the coins and gems they cost.
    cr_o := greatest(floor(public.econ_num(o, 'crates')), 0)::int;
    cr_n := greatest(floor(public.econ_num(s, 'crates')), 0)::int;
    if cr_n < cr_o then
      if s ? 'crates' then fixes := fixes || jsonb_build_object('crates', cr_o); end if;
      cr_n := cr_o;
    end if;
    if cr_n > cr_o then
      cr_p := econ_private.crate_pay(cr_o, cr_n);
      if cr_n > (cr_p ->> 'n')::int then
        cr_n := greatest((cr_p ->> 'n')::int, cr_o);
        fixes := fixes || jsonb_build_object('crates', cr_n);
        cr_p := econ_private.crate_pay(cr_o, cr_n);
      end if;
      select coalesce(array_agg(x ->> 'uid'), '{}') into cr_uids from jsonb_array_elements(cr_p -> 'cars') x;
      cr_mods := cr_p -> 'mods';
      cr_bucks := (cr_p ->> 'cost_bucks')::numeric;
      cr_net := (cr_p ->> 'coins')::numeric - (cr_p ->> 'cost_coins')::numeric
        + coalesce((select sum((cat -> 'cars' -> (x ->> 'model') ->> 'price')::numeric) from jsonb_array_elements(cr_p -> 'cars') x), 0)
        + coalesce((select sum(coalesce((cat -> 'mods' -> (x ->> 'mod') ->> 'coins')::numeric, 0) + coalesce((cat -> 'mods' -> (x ->> 'mod') ->> 'parts')::numeric, 0) * 50)
                    from jsonb_array_elements(cr_mods) x), 0);
    end if;
    s := jsonb_set(s, '{crates}', to_jsonb(cr_n));

    -- Cars come at their level: a new car above the player's level goes back and its coins and bucks
    -- are refunded. Rusty's cars (the restored car or any rescue find), one Grand Prix prize from the
    -- box, season cars (unlock 0) and cars a server grant noted (econ_private.car_granted) are kept.
    for r in select x from jsonb_array_elements(cars) x
             where not (x ->> 'uid') = any(o_uids)
               and coalesce((cat -> 'cars' -> (x ->> 'model') ->> 'unlock')::int, 0) > g_lvl loop
      continue when r.x ->> 'uid' is not distinct from restored or r.x ->> 'uid' is not distinct from restored2;
      continue when exists (select 1 from econ_private.rescue_find(r.x ->> 'uid') f where f.model = r.x ->> 'model');
      continue when econ_private.car_granted(r.x ->> 'uid', r.x ->> 'model');
      if gp_box is not null and not gp_free and gp_box ? (r.x ->> 'model') then
        gp_free := true;
        continue;
      end if;
      lock_price := coalesce((cat -> 'cars' -> (r.x ->> 'model') ->> 'price')::numeric, 0);
      lock_bucks := coalesce((cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric, 0);
      cars := (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(cars) y where y ->> 'uid' <> r.x ->> 'uid');
      s := s || jsonb_build_object('coins', public.econ_num(s, 'coins') + lock_price, 'bucks', public.econ_num(s, 'bucks') + lock_bucks);
      fixes := fixes || jsonb_build_object('locked_car', r.x ->> 'model');
    end loop;
    s := jsonb_set(s, '{cars}', cars);

    -- Car mastery (game/mastery.ts), per car model: races, wins, the modes won in, upsets (wins over
    -- a higher PI) and the tier reached. Counts never drop; wins can't pass races, upsets can't pass
    -- wins, and every model's wins together can't pass the town's race wins (else the last save's
    -- mastery stays). A tier newly reached pays its gems and trophies once, if the counts meet every
    -- tier's needs up to it and the model is in the garage. A save with no mastery keeps the old.
    o_mas := case when jsonb_typeof(o -> 'mastery') = 'object' then o -> 'mastery' else '{}' end;
    if jsonb_typeof(s -> 'mastery') is distinct from 'object' then
      if o_mas <> '{}' then s := jsonb_set(s, '{mastery}', o_mas); end if;
    elsif jsonb_typeof(cat -> 'mastery' -> 'tiers') = 'array' then
      mas := o_mas;
      for r in select x.key k, x.value v from jsonb_each(s -> 'mastery') x where jsonb_typeof(x.value) = 'object' loop
        mo := case when jsonb_typeof(o_mas -> r.k) = 'object' then o_mas -> r.k else '{}' end;
        m_races := greatest(floor(public.econ_num(r.v, 'races')), floor(public.econ_num(mo, 'races')), 0);
        m_wins := least(greatest(floor(public.econ_num(r.v, 'wins')), floor(public.econ_num(mo, 'wins')), 0), m_races);
        m_upsets := least(greatest(floor(public.econ_num(r.v, 'upsets')), floor(public.econ_num(mo, 'upsets')), 0), m_wins);
        m_modes := (select coalesce(jsonb_agg(distinct x2), '[]') from jsonb_array_elements(
                      case when jsonb_typeof(r.v -> 'modes') = 'array' then r.v -> 'modes' else '[]' end
                      || case when jsonb_typeof(mo -> 'modes') = 'array' then mo -> 'modes' else '[]' end) x2
                    where jsonb_typeof(x2) = 'string');
        if jsonb_array_length(m_modes) > 12 then m_modes := case when jsonb_typeof(mo -> 'modes') = 'array' then mo -> 'modes' else '[]' end; end if;
        m_old := least(greatest(floor(public.econ_num(mo, 'tier')), 0), jsonb_array_length(cat -> 'mastery' -> 'tiers'))::int;
        m_ok := 0;
        for mt in select t from jsonb_array_elements(cat -> 'mastery' -> 'tiers') t loop
          exit when m_races < (mt ->> 'races')::numeric or m_wins < (mt ->> 'wins')::numeric
                 or jsonb_array_length(m_modes) < (mt ->> 'modes')::numeric or m_upsets < (mt ->> 'upsets')::numeric;
          m_ok := m_ok + 1;
        end loop;
        m_tier := least(greatest(floor(public.econ_num(r.v, 'tier')), m_old), greatest(m_ok, m_old))::int;
        if m_tier > m_old and not exists (select 1 from jsonb_array_elements(cars) x3 where x3 ->> 'model' = r.k) then
          m_tier := m_old;
        end if;
        if m_tier < floor(public.econ_num(r.v, 'tier')) then
          fixes := fixes || jsonb_build_object('mastery', r.k);
        end if;
        for rd_i in m_old + 1 .. m_tier loop
          ms_bucks := ms_bucks + (cat -> 'mastery' -> 'tiers' -> (rd_i - 1) ->> 'bucks')::numeric;
          ms_trophies := ms_trophies + (cat -> 'mastery' -> 'tiers' -> (rd_i - 1) ->> 'trophies')::numeric;
        end loop;
        mas := mas || jsonb_build_object(r.k, jsonb_build_object('races', m_races, 'wins', m_wins, 'modes', m_modes, 'upsets', m_upsets, 'tier', m_tier));
      end loop;
      select coalesce(sum(public.econ_num(x.value, 'wins')), 0) into ms_wins from jsonb_each(mas) x where jsonb_typeof(x.value) = 'object';
      if ms_wins > least(public.econ_num(s, 'racesWon'), public.econ_num(o, 'racesWon') + floor(win_bank)) and mas is distinct from o_mas then
        fixes := fixes || '{"mastery":"more wins than races won"}';
        mas := o_mas;
        ms_bucks := 0;
        ms_trophies := 0;
      end if;
      s := jsonb_set(s, '{mastery}', mas);
    end if;

    -- Trophy Road (game/trophyRoad.ts): stops claimed never go down and can't pass the stops the
    -- trophies reach (at most what this save may add). Each newly claimed stop pays its coins and
    -- parts once. A save with no road keeps the old.
    if jsonb_typeof(cat -> 'road') = 'object' then
      rd_o := greatest(floor(public.econ_num(o, 'road')), 0);
      if jsonb_typeof(s -> 'road') is distinct from 'number' then
        if o ? 'road' then s := jsonb_set(s, '{road}', to_jsonb(rd_o)); end if;
      else
        rd_max := floor(least(public.econ_num(s, 'trophies'),
                              public.econ_num(o, 'trophies') + trophy_bank + case when gp_series is not null then 5 else 0 end
                              + camp_trophies + set_trophies + tr_trophies + ms_trophies) / (cat -> 'road' ->> 'step')::numeric);
        rd_n := least(greatest(floor(public.econ_num(s, 'road')), rd_o), greatest(rd_max, rd_o));
        if rd_n <> public.econ_num(s, 'road') then
          fixes := fixes || jsonb_build_object('road', jsonb_build_object('sent', public.econ_num(s, 'road'), 'kept', rd_n));
        end if;
        for rd_i in rd_o::int .. (rd_n - 1)::int loop
          rd_p := coalesce(cat -> 'road' -> 'stops' -> rd_i, cat -> 'road' -> 'after');
          rd_coins := rd_coins + (rd_p ->> 'coins')::numeric;
          rd_parts := rd_parts + (rd_p ->> 'parts')::numeric;
        end loop;
        s := jsonb_set(s, '{road}', to_jsonb(rd_n));
      end if;
    end if;

    -- Bucks: only what levels, goals, the daily bonus, campaign bonuses, collection sets, task chests, season tiers and car mastery pay, less any bucks-only car bought.
    for r in select x from jsonb_array_elements(cars) x loop
      if not (r.x ->> 'uid') = any(o_uids) and (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric > 0
         and r.x ->> 'uid' is distinct from restored and r.x ->> 'uid' is distinct from restored2 and not (r.x ->> 'uid') = any(cr_uids) then
        if gp_box is not null and gp_box ? (r.x ->> 'model') then
          gp_box := null; -- the prize car is free
        else
          bucks_cost := bucks_cost + (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric;
        end if;
      end if;
    end loop;
    -- Bucks-only mods bought since the last save are paid for too.
    bucks_cost := bucks_cost + coalesce((select sum(n.bucks) from public.econ_new_bucks_mods(cars, o, cat) n
                                           where not cr_mods @> jsonb_build_array(jsonb_build_object('car', n.uid, 'mod', n.id))), 0);
    max_bucks := greatest(public.econ_num(o, 'bucks'), 0) + (n_lvl - o_lvl) + goal_bucks + daily_bucks + camp_bucks + set_bucks + q_bucks + sea_bucks + tr_bucks + ms_bucks + pay_bucks - bucks_cost - cr_bucks;
    if max_bucks < 0 then
      -- Unpaid bucks-only mods come off first, then unpaid bucks-only cars.
      for r2 in select * from public.econ_new_bucks_mods(cars, o, cat) n
                 where not cr_mods @> jsonb_build_array(jsonb_build_object('car', n.uid, 'mod', n.id)) order by bucks desc loop
        exit when max_bucks >= 0;
        cars := (select coalesce(jsonb_agg(case when y ->> 'uid' = r2.uid
                   then y || jsonb_build_object(
                     'mods', coalesce((select jsonb_agg(m) from jsonb_array_elements(case when jsonb_typeof(y -> 'mods') = 'array' then y -> 'mods' else '[]' end) m where m #>> '{}' is distinct from r2.id), '[]'),
                     'ownedMods', coalesce((select jsonb_agg(m) from jsonb_array_elements(case when jsonb_typeof(y -> 'ownedMods') = 'array' then y -> 'ownedMods' else '[]' end) m where m #>> '{}' is distinct from r2.id), '[]'))
                   else y end order by ord), '[]')
                 from jsonb_array_elements(cars) with ordinality t(y, ord));
        max_bucks := max_bucks + r2.bucks;
        fixes := fixes || jsonb_build_object('unpaid_mod', r2.id);
      end loop;
      s := jsonb_set(s, '{cars}', cars);
    end if;
    if max_bucks < 0 then
      -- Bucks-only cars that weren't paid for go back.
      for r in select x from jsonb_array_elements(cars) x
               where not (x ->> 'uid') = any(o_uids) and not (x ->> 'uid') = any(cr_uids) and (cat -> 'cars' -> (x ->> 'model') ->> 'bucks')::numeric > 0
               order by (cat -> 'cars' -> (x ->> 'model') ->> 'bucks')::numeric desc loop
        exit when max_bucks >= 0;
        cars := (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(cars) y where y ->> 'uid' <> r.x ->> 'uid');
        max_bucks := max_bucks + (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric;
        fixes := fixes || jsonb_build_object('unpaid_car', r.x ->> 'model');
      end loop;
      s := jsonb_set(s, '{cars}', cars);
      max_bucks := greatest(max_bucks, 0);
    end if;
    if public.econ_num(s, 'bucks') > max_bucks or public.econ_num(s, 'bucks') < 0 then
      fixes := fixes || jsonb_build_object('bucks', jsonb_build_object('sent', public.econ_num(s, 'bucks'), 'kept', least(greatest(public.econ_num(s, 'bucks'), 0), max_bucks)));
      s := jsonb_set(s, '{bucks}', to_jsonb(least(greatest(public.econ_num(s, 'bucks'), 0), max_bucks)));
    end if;

    -- Town worth: grows only as fast as play allows, plus the exact payouts above.
    if public.econ_num(s, 'coins') < 0 then s := jsonb_set(s, '{coins}', '0'); end if;
    if public.econ_num(s, 'parts') < 0 then s := jsonb_set(s, '{parts}', '0'); end if;
    o_value := public.econ_value(o, cat);
    gain := public.econ_value(s, cat) - o_value;
    if gain - cr_net < 0 then -- (crate costs don't pay for restores)
      e := e || jsonb_build_object('spent', least(coalesce((e ->> 'spent')::numeric, 50000) - (gain - cr_net), 1e6));
    end if;
    allow := deal_save + tr_coins + levelup_coins + goal_coins + daily_coins + gp_value + restore_value + camp_coins + set_coins + q_coins + q_parts * 50
             + sea_coins + sea_parts * 50 + sea_value + cr_net + rd_coins + rd_parts * 50 + pay_coins + pay_parts * 50;
    if gain > val_bank + allow then
      fixes := fixes || jsonb_build_object('worth', jsonb_build_object('sent', round(gain), 'kept', floor(val_bank + allow)));
      limit_value := o_value + val_bank + allow;
      val_bank := 0;
      -- Take it back from coins first, then new cars, parts, car upgrades, car mods, building upgrades and new buildings.
      excess := public.econ_value(s, cat) - limit_value;
      take := least(ceil(excess), public.econ_num(s, 'coins'));
      s := jsonb_set(s, '{coins}', to_jsonb(floor(public.econ_num(s, 'coins') - take)));
      excess := public.econ_value(s, cat) - limit_value;
      for r in select x from jsonb_array_elements(s -> 'cars') x
               where not (x ->> 'uid') = any(o_uids) and cat -> 'cars' ? (x ->> 'model')
               order by public.econ_car_value(x, cat) desc loop
        exit when excess <= 0;
        s := jsonb_set(s, '{cars}', (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(s -> 'cars') y where y ->> 'uid' <> r.x ->> 'uid'));
        excess := public.econ_value(s, cat) - limit_value;
      end loop;
      if excess > 0 then
        take := least(ceil(excess / 50), public.econ_num(s, 'parts'));
        s := jsonb_set(s, '{parts}', to_jsonb(floor(public.econ_num(s, 'parts') - take)));
        excess := public.econ_value(s, cat) - limit_value;
      end if;
      if excess > 0 then
        s := jsonb_set(s, '{cars}', (
          select coalesce(jsonb_agg(case when oc is null then y else y || jsonb_build_object('upgrades', jsonb_build_object(
            'engine', least(public.econ_upgrade(y, 'engine'), public.econ_upgrade(oc, 'engine')),
            'turbo', least(public.econ_upgrade(y, 'turbo'), public.econ_upgrade(oc, 'turbo')),
            'tires', least(public.econ_upgrade(y, 'tires'), public.econ_upgrade(oc, 'tires')),
            'weight', least(public.econ_upgrade(y, 'weight'), public.econ_upgrade(oc, 'weight')))) end order by ord), '[]')
          from jsonb_array_elements(s -> 'cars') with ordinality t(y, ord)
          left join lateral (select z as oc from jsonb_array_elements(o -> 'cars') z where z ->> 'uid' = y ->> 'uid' limit 1) old_car on true));
        excess := public.econ_value(s, cat) - limit_value;
      end if;
      if excess > 0 then
        -- Car mods go back to what each car had bought and fitted in the last save.
        s := jsonb_set(s, '{cars}', (
          select coalesce(jsonb_agg(case when oc is null then y
                                         else y || jsonb_build_object('mods', coalesce(oc -> 'mods', '[]'), 'ownedMods', coalesce(oc -> 'ownedMods', '[]')) end order by ord), '[]')
          from jsonb_array_elements(s -> 'cars') with ordinality t(y, ord)
          left join lateral (select z as oc from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) z
                             where z ->> 'uid' = y ->> 'uid' limit 1) old_car on true));
        excess := public.econ_value(s, cat) - limit_value;
      end if;
      if excess > 0 and jsonb_typeof(s -> 'buildings') = 'array' then
        -- Building upgrades go back to their last saved level.
        for r in select x, public.econ_old_blvl(o, x) ol from jsonb_array_elements(s -> 'buildings') x
                 where public.econ_blvl(x) > public.econ_old_blvl(o, x) and cat -> 'buildings' -> (x ->> 'def') ? 'up'
                 order by (cat -> 'buildings' -> (x ->> 'def') -> 'up' -> 'spend' ->> (public.econ_blvl(x) - 1))::numeric desc loop
          exit when excess <= 0;
          s := jsonb_set(s, '{buildings}', (
            select coalesce(jsonb_agg(case when y ->> 'uid' = r.x ->> 'uid' then y || jsonb_build_object('level', r.ol) else y end order by ord), '[]')
            from jsonb_array_elements(s -> 'buildings') with ordinality t(y, ord)));
          excess := public.econ_value(s, cat) - limit_value;
        end loop;
      end if;
      if excess > 0 and jsonb_typeof(s -> 'buildings') = 'array' then
        for r in select x from jsonb_array_elements(s -> 'buildings') x
                 where not coalesce((cat -> 'buildings' -> (x ->> 'def') ->> 'obstacle')::boolean, true)
                   and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'buildings') = 'array' then o -> 'buildings' else '[]' end) z
                                   where z ->> 'uid' = x ->> 'uid')
                 order by (cat -> 'buildings' -> (x ->> 'def') ->> 'price')::numeric desc loop
          exit when excess <= 0;
          s := jsonb_set(s, '{buildings}', (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(s -> 'buildings') y where y ->> 'uid' <> r.x ->> 'uid'));
          excess := public.econ_value(s, cat) - limit_value;
        end loop;
      end if;
    else
      val_bank := val_bank - greatest(gain - allow, 0);
    end if;

    -- Race wins and trophies: about one race every 20 seconds at most.
    gain := public.econ_num(s, 'racesWon') - public.econ_num(o, 'racesWon');
    if gain > win_bank then
      fixes := fixes || jsonb_build_object('racesWon', jsonb_build_object('sent', gain, 'kept', floor(win_bank)));
      s := jsonb_set(s, '{racesWon}', to_jsonb(public.econ_num(o, 'racesWon') + floor(win_bank)));
      win_bank := 0;
    else
      win_bank := win_bank - greatest(gain, 0);
    end if;
    gain := public.econ_num(s, 'trophies') - public.econ_num(o, 'trophies');
    allow := case when gp_series is not null then 5 else 0 end + camp_trophies + set_trophies + tr_trophies + ms_trophies;
    if gain > trophy_bank + allow then
      fixes := fixes || jsonb_build_object('trophies', jsonb_build_object('sent', gain, 'kept', floor(trophy_bank + allow)));
      s := jsonb_set(s, '{trophies}', to_jsonb(public.econ_num(o, 'trophies') + floor(trophy_bank + allow)));
      trophy_bank := 0;
    else
      trophy_bank := trophy_bank - greatest(gain - allow, 0);
    end if;

    -- Fuel stays near its cap (loot and the daily bonus can top it over).
    cap := 15 + n_lvl * 2 + coalesce((select sum(coalesce((cat -> 'buildings' -> (b ->> 'def') -> 'up' -> 'fuel' ->> (public.econ_blvl(b) - 1))::numeric,
                                                       (cat -> 'buildings' -> (b ->> 'def') ->> 'fuelCap')::numeric))
            from jsonb_array_elements(case when jsonb_typeof(s -> 'buildings') = 'array' then s -> 'buildings' else '[]' end) b), 0);
    if public.econ_num(s, 'fuel') > cap + 200 or public.econ_num(s, 'fuel') < 0 then
      fixes := fixes || jsonb_build_object('fuel', jsonb_build_object('sent', public.econ_num(s, 'fuel'), 'kept', least(greatest(public.econ_num(s, 'fuel'), 0), cap + 200)));
      s := jsonb_set(s, '{fuel}', to_jsonb(least(greatest(public.econ_num(s, 'fuel'), 0), cap + 200)));
    end if;

    new.econ := e || jsonb_build_object('at', now_s, 'xp', round(xp_bank, 2), 'value', round(val_bank, 2),
      'wins', round(win_bank, 3), 'trophies', round(trophy_bank, 3));
    if fixes <> '{}' then
      new.corrections := fixes;
      perform econ_private.econ_flag(new.owner_id, fixes);
    end if;
    new.state := s;
  end if;

  -- Public columns come from the checked save.
  new.level := least(greatest(floor(public.econ_num(s, 'level')), 1), 200)::int;
  new.town_name := coalesce(nullif(left(trim(s ->> 'townName'), 24), ''), 'My Town');
  new.trophies := least(greatest(floor(public.econ_num(s, 'trophies')), 0), 2e9)::int;
  new.race_wins := least(greatest(floor(public.econ_num(s, 'racesWon')), 0), 2e9)::int;
  select coalesce(sum(pi), 0) into new.power from (
    select public.econ_car_pi(x, cat) pi from jsonb_array_elements(case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end) x
    where cat -> 'cars' ? (x ->> 'model') order by 1 desc limit 5) top;
  select jsonb_build_object('name', cat -> 'cars' -> (x ->> 'model') ->> 'name', 'color', x ->> 'color',
                            'pi', public.econ_car_pi(x, cat), 'body', cat -> 'cars' -> (x ->> 'model') ->> 'body',
                            'mods', (select coalesce(jsonb_agg(f.id), '[]') from public.econ_fitted_mods(x, cat) f))
    into new.best_car
    from jsonb_array_elements(case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end) x
    where cat -> 'cars' ? (x ->> 'model') order by public.econ_car_pi(x, cat) desc limit 1;
  return new;
end $function$;
