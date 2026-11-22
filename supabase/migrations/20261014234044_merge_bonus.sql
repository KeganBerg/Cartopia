-- 0088 Merge bonus (2026-10-14; Kegan asked for merging to give a real resource boost).
-- Every building in a merged block now earns more coins and parts per job (MERGE_BONUS in
-- src/game/data.ts): +10% in a pair, +25% in a 2x2, +50% in a giant 4x4. Merged houses and
-- gas stations also hold that much more fuel, which the guard's +200 fuel slack already covers.
-- econ_upgrade_rate() is 0010's with one change: the town-worth bank refills faster by each
-- merged block's bonus on its buildings' full per-minute rate.
--   * Only the block's top-left building carries `merge` (21/12 a pair, 2 a 2x2, 4 a 4x4).
--     The bank counts members by that code, capped per building type and level at +50% on
--     every such building the save holds, so a forged flag can never beat a real 4x4.
-- Loosens a check only (no new ids), so it runs BEFORE the client that pays the bonus ships.
-- Needs no econ_guard change: the guard calls econ_upgrade_rate() for the bank rate.

create or replace function public.econ_upgrade_rate(s jsonb, cat jsonb, out coins numeric, out xp numeric)
language sql immutable set search_path = '' as $$
  with b as (
    select x as b, cat -> 'buildings' -> (x ->> 'def') -> 'up' as u, public.econ_blvl(x) as l
    from jsonb_array_elements(case when jsonb_typeof(s -> 'buildings') = 'array' then s -> 'buildings' else '[]' end) x
  ), up as (
    select * from b where u is not null
  ), merged as (
    -- merge:begin
    select (b ->> 'def') as def, l, count(*) as n,
           sum(case b ->> 'merge' when '21' then 2 * 0.1 when '12' then 2 * 0.1 when '2' then 4 * 0.25 when '4' then 16 * 0.5 else 0 end) as want
    -- merge:end
    from up group by 1, 2
  )
  select coalesce(sum((u -> 'coins' ->> (l - 1))::numeric - (u -> 'coins' ->> 0)::numeric
                      + case when jsonb_typeof(b -> 'car') = 'string'
                             then (u -> 'coins' ->> (l - 1))::numeric * coalesce((cat ->> 'driverBonus')::numeric, 0)
                             else 0 end), 0)
           + coalesce((select sum(least(m.want, 0.5 * m.n) * (cat -> 'buildings' -> m.def -> 'up' -> 'coins' ->> (m.l - 1))::numeric)
                       from merged m), 0),
         coalesce(sum((u -> 'xp' ->> (l - 1))::numeric - (u -> 'xp' ->> 0)::numeric), 0)
  from up
$$;
