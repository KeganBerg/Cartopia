-- Size limits (security audit follow-up, 2026-10-11). Replaces no existing function.
--
--   1. A player's save is refused when it is far bigger than any real town can be: over 1 MB of
--      JSON, or more cars, buildings, roads or junkyard finds than the map and game allow. The
--      largest live save is about 9 KB; the map holds at most 49 plots of 8x8 = 3,136 tiles.
--      Without this, one save of junk could fill the database or be served to every visitor,
--      and a few thousand cars keep the guard busy for seconds per save.
--      The refusal uses check_violation (23514), so the game reloads the server's copy.
--   2. A player can start at most 40 live races in 10 minutes (one every 15 seconds), so race
--      rows can't be created in bulk.

-- 1. Save size --------------------------------------------------------------------------------
create or replace function public.econ_bounds() returns trigger
language plpgsql set search_path = '' as $$
declare
  fld text;
  cap int;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if octet_length(new.state::text) > 1048576 then
    raise exception 'save is too large' using errcode = 'check_violation';
  end if;
  for fld, cap in select * from (values ('cars', 1000), ('buildings', 4000), ('roads', 4000), ('junkyard', 200), ('land', 49)) v loop
    if jsonb_typeof(new.state -> fld) = 'array' and jsonb_array_length(new.state -> fld) > cap then
      raise exception 'save has too many %', fld using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;

-- Before-triggers fire in name order: "econ_bounds" runs before "econ_car_identity" and "econ_guard".
drop trigger if exists econ_bounds on public.game_saves;
create trigger econ_bounds before insert or update on public.game_saves
  for each row execute function public.econ_bounds();

-- 2. Live race rate limit ----------------------------------------------------------------------
create or replace function public.race_rate_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.live_races where a = new.a and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'too many races, try again in a few minutes' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists race_rate_limit on public.live_races;
create trigger race_rate_limit before insert on public.live_races
  for each row execute function public.race_rate_limit();

create index if not exists live_races_a_created_idx on public.live_races (a, created_at);
