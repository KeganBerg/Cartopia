-- Stuck items (2026-10-11). Poop bushes (def "poop", src/game/data.ts) are planted on a town by an
-- admin from the SQL editor. The player can't bulldoze, clear or move them; building on top of one
-- squashes it for good. This trigger holds a player's save to that: a poop bush the old save had
-- that the new one drops (or moves) comes back unless a building now stands on its tile.
--
-- It is its own trigger, so a later replacement of econ_guard() doesn't drop it, and it touches no
-- other function. The catalog leaves "poop" out, and the guard treats unknown ids as free obstacles.
-- Trusted writes (SQL editor, service role) skip it. Safe to run at any time.

create or replace function econ_private.econ_stuck() returns trigger
language plpgsql set search_path = '' as $$
declare
  o jsonb := old.state;
  s jsonb := new.state;
  sb jsonb;
  lost jsonb;
begin
  if tg_op <> 'UPDATE' or current_user not in ('authenticated', 'anon')
     or jsonb_typeof(o -> 'buildings') is distinct from 'array' or jsonb_typeof(s) is distinct from 'object' then
    return new;
  end if;
  sb := case when jsonb_typeof(s -> 'buildings') = 'array' then s -> 'buildings' else '[]' end;
  -- Gone (or moved) without a building on the tile. Buildings are at most 2x2, so a building
  -- counts as covering the 2x2 square from its corner whatever its size or turn.
  select coalesce(jsonb_agg(p), '[]') into lost
  from jsonb_array_elements(o -> 'buildings') p
  where p ->> 'def' = 'poop' and jsonb_typeof(p -> 'x') = 'number' and jsonb_typeof(p -> 'z') = 'number'
    and not exists (select 1 from jsonb_array_elements(sb) q
                    where q ->> 'uid' = p ->> 'uid' and q ->> 'def' = 'poop' and q -> 'x' = p -> 'x' and q -> 'z' = p -> 'z')
    and not exists (select 1 from jsonb_array_elements(sb) b
                    where b ->> 'def' is distinct from 'poop' and jsonb_typeof(b -> 'x') = 'number' and jsonb_typeof(b -> 'z') = 'number'
                      and (p ->> 'x')::numeric - (b ->> 'x')::numeric between 0 and 1
                      and (p ->> 'z')::numeric - (b ->> 'z')::numeric between 0 and 1);
  if jsonb_array_length(lost) > 0 then
    new.state := jsonb_set(s, '{buildings}',
      (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(sb) y
       where not coalesce((y ->> 'uid') = any(array(select l ->> 'uid' from jsonb_array_elements(lost) l)), false)) || lost);
    -- Makes the game reload the server's copy.
    new.corrections := coalesce(new.corrections, '{}') || '{"poop":"not going anywhere"}';
  end if;
  return new;
end $$;

revoke all on function econ_private.econ_stuck() from public, anon, authenticated;

-- Before-triggers fire in name order: "econ_stuck" runs after "econ_guard" and "econ_progress",
-- so a building the guard takes back doesn't count as covering a bush.
drop trigger if exists econ_stuck on public.game_saves;
create trigger econ_stuck before update on public.game_saves
  for each row execute function econ_private.econ_stuck();
