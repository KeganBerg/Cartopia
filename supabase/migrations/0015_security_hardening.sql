-- Security audit fixes (2026-10-11). Changes no player's saved progress and replaces neither
-- econ_guard() nor econ_catalog(), so it can run before or after other pending economy SQL.
--
--   1. A car keeps its model for life. The guard only charges bucks for cars whose uid is new, so
--      a save could turn an owned car into a bucks-only supercar, or copy one many times, for free.
--      A new trigger, run just before econ_guard, puts a swapped car back to its saved model and
--      drops repeated or blank uids. Honest clients never do either (every new car gets a new uid).
--   2. Crew names, tags and mottos pass the same word filter as the game (isCleanName in
--      src/lib/names.ts) when written through the API, not only in the browser.
--   3. Internal race helpers are no longer callable from the API.
--   4. The unused tables from the first schema (profiles, garage_cars, town_tiles, car_models)
--      can't be written by players any more.

-- 1. Car identity ------------------------------------------------------------------------------
create or replace function public.econ_car_identity() returns trigger
language plpgsql set search_path = '' as $$
declare
  old_cars jsonb := '{}';
  cars jsonb := '[]';
  seen text[] := '{}';
  fixes jsonb := '{}';
  c jsonb;
  u text;
begin
  if current_user not in ('authenticated', 'anon') or jsonb_typeof(new.state -> 'cars') is distinct from 'array' then
    return new;
  end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.state -> 'cars') = 'array' then
    select coalesce(jsonb_object_agg(x ->> 'uid', x), '{}') into old_cars
      from jsonb_array_elements(old.state -> 'cars') x
      where jsonb_typeof(x) = 'object' and coalesce(x ->> 'uid', '') <> '';
  end if;
  for c in select x from jsonb_array_elements(new.state -> 'cars') x loop
    u := case when jsonb_typeof(c) = 'object' then c ->> 'uid' end;
    if u is null then
      cars := cars || jsonb_build_array(c); -- not a car; the guard drops these itself
      continue;
    end if;
    if u = '' then
      -- The guard's starter town uses blank uids, so a blank uid would pass as an old car.
      fixes := fixes || '{"blank_car_uid": true}';
      continue;
    end if;
    if u = any(seen) then
      fixes := fixes || jsonb_build_object('duplicate_car', u);
      continue;
    end if;
    seen := seen || u;
    if old_cars ? u and (old_cars -> u ->> 'model') is distinct from (c ->> 'model') then
      fixes := fixes || jsonb_build_object('model_swap', u);
      c := old_cars -> u;
    end if;
    cars := cars || jsonb_build_array(c);
  end loop;
  if fixes <> '{}' then
    new.state := jsonb_set(new.state, '{cars}', cars);
    perform econ_private.econ_flag(new.owner_id, fixes);
  end if;
  return new;
end $$;

-- Before-triggers fire in name order: this one ("econ_car...") runs before "econ_guard".
drop trigger if exists econ_car_identity on public.game_saves;
create trigger econ_car_identity before insert or update on public.game_saves
  for each row execute function public.econ_car_identity();

-- 2. Name filter -------------------------------------------------------------------------------
-- Same rules and word lists as isCleanName() in src/lib/names.ts (names.test.ts checks they match).
create or replace function public.name_ok(name text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  t text := translate(lower(coalesce(name, '')), '01!|34@5$7+89', 'oiiieaassttbg');
  ok text;
  squashed text;
begin
  -- names:begin
  foreach ok in array array['cocktail', 'peacock', 'hitchcock', 'dickens', 'scunthorpe', 'cockpit', 'shuttlecock', 'raccoon', 'cocoon', 'tycoon', 'spice', 'spicy', 'conspicuous', 'racoon', 'torpedo', 'pedometer', 'cockatoo', 'cockroach', 'gamecock', 'cumulus', 'cucumber', 'circumference', 'document', 'analog', 'analysis', 'canal', 'banal', 'pakistan', 'grape', 'drape', 'scrape', 'therapist'] loop
    t := replace(t, ok, ' ');
  end loop;
  squashed := regexp_replace(t, '[^a-z]', '', 'g');
  if exists (select 1 from unnest(array[
      'nigg', 'nigr', 'niga', 'nlgg', 'faggot', 'fagot', 'faggit', 'kike', 'chink', 'spic', 'wetback', 'beaner',
      'tranny', 'retard', 'raghead', 'towelhead', 'coon', 'gook', 'paki', 'dyke', 'kkk', 'hitler', 'nazi',
      'fuck', 'fuk', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'cock', 'dick', 'pussy', 'penis', 'vagina',
      'porn', 'rape', 'molest', 'pedo', 'jizz', 'twat', 'wank', 'bastard', 'asshole', 'dildo', 'anal']) w
    where strpos(squashed, w) > 0) then
    return false;
  end if;
  return not exists (select 1 from regexp_split_to_table(t, '[^a-z]+') w
    where w = any(array['ass', 'fag', 'nig', 'tit', 'tits', 'sex', 'hoe', 'hoes', 'jap', 'homo', 'cum']));
  -- names:end
end $$;

create or replace function public.create_clan(p_name text, p_tag text, p_emblem text, p_color text, p_description text, p_min_level int default 1)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'Sign in to start a clan'; end if;
  if not (public.name_ok(p_name) and public.name_ok(p_tag) and public.name_ok(p_description)) then
    raise exception 'That name isn''t allowed. Try something else.';
  end if;
  if exists (select 1 from public.clan_members where owner_id = me) then raise exception 'Leave your current clan first'; end if;
  if exists (select 1 from public.clans where lower(name) = lower(trim(p_name))) then raise exception 'That clan name is taken'; end if;
  if exists (select 1 from public.clans where tag = upper(trim(p_tag))) then raise exception 'That tag is taken'; end if;
  insert into public.clans (name, tag, emblem, color, description, leader_id, min_level)
  values (trim(p_name), upper(trim(p_tag)), left(coalesce(nullif(p_emblem, ''), '🏁'), 8), coalesce(p_color, '#ff7043'), left(coalesce(p_description, ''), 140), me, greatest(1, coalesce(p_min_level, 1)))
  returning id into cid;
  insert into public.clan_members (owner_id, clan_id, role) values (me, cid, 'leader');
  return cid;
end $$;

create or replace function public.update_clan(p_description text, p_emblem text, p_color text, p_min_level int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if not public.name_ok(p_description) then
    raise exception 'That name isn''t allowed. Try something else.';
  end if;
  update public.clans set
    description = left(coalesce(p_description, description), 140),
    emblem = left(coalesce(nullif(p_emblem, ''), emblem), 8),
    color = coalesce(p_color, color),
    min_level = greatest(1, coalesce(p_min_level, min_level))
  where leader_id = me;
  if not found then raise exception 'Only the clan leader can do that'; end if;
end $$;

-- 3. Race helpers that only the race RPCs should run -------------------------------------------
revoke execute on function public.race_decide(text), public.race_view(public.live_races, uuid) from public, anon, authenticated;

-- 4. Unused first-schema tables: read-only for players ------------------------------------------
revoke insert, update, delete, truncate on public.profiles, public.garage_cars, public.town_tiles, public.car_models from anon, authenticated;
