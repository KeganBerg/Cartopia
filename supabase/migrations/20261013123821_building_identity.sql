-- 0077 Building identity (2026-10-13, economy thread). Standalone: a new before-trigger, no
-- econ_guard/econ_catalog change, so it can run any time.
-- The guard only takes back a building whose uid isn't in the last save, so copies of an owned
-- building (the same uid again, now easy to hide as `stored: true` inventory from "Bulldoze to
-- inventory") or blank uids (the guard's starter town uses blank ones) kept their worth, income and
-- fuel even when the save couldn't pay for them. Like econ_car_identity (0015) for cars, this keeps the
-- first building with each uid and drops blank-uid and repeated ones, and flags the save. No live save
-- has a blank or repeated building uid (checked 2026-10-13). Runs before econ_guard (trigger names
-- run in alphabetical order).

create or replace function public.econ_building_identity() returns trigger
language plpgsql set search_path = '' as $$
declare
  kept jsonb := '[]';
  seen text[] := '{}';
  fixes jsonb := '{}';
  b jsonb;
  u text;
begin
  if current_user not in ('authenticated', 'anon') or jsonb_typeof(new.state -> 'buildings') is distinct from 'array' then
    return new;
  end if;
  for b in select x from jsonb_array_elements(new.state -> 'buildings') x loop
    u := case when jsonb_typeof(b) = 'object' then b ->> 'uid' end;
    if u is null then
      kept := kept || jsonb_build_array(b); -- not a building; the guard drops these itself
      continue;
    end if;
    if u = '' then
      fixes := fixes || '{"blank_building_uid": true}';
      continue;
    end if;
    if u = any(seen) then
      fixes := fixes || jsonb_build_object('duplicate_building', u);
      continue;
    end if;
    seen := seen || u;
    kept := kept || jsonb_build_array(b);
  end loop;
  if fixes <> '{}' then
    new.state := jsonb_set(new.state, '{buildings}', kept);
    perform econ_private.econ_flag(new.owner_id, fixes);
  end if;
  return new;
end $$;
revoke all on function public.econ_building_identity() from public, anon, authenticated;

drop trigger if exists econ_building_identity on public.game_saves;
create trigger econ_building_identity before insert or update on public.game_saves
  for each row execute function public.econ_building_identity();
