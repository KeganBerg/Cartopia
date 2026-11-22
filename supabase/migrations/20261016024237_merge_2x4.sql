-- 0107 Merged 2x4 blocks (2026-10-16; Kegan: "these should merge"; thread "More buildings in every
-- category", written by "Cheat-proof economy"). Two matching merged 2x2 blocks side by side merge
-- into one 2x4 of eight buildings at +35% (merge code 42 wide, 24 tall, on its top-left building).
-- econ_upgrade_rate() is 0088's (live 58cc5a83) with only those two codes added to the merge
-- block; the per building type and level cap (+50%) stays. No econ_guard or catalog change.
-- RUN ORDER: BEFORE the game update with 2x4 merges (until it runs, a 2x4 earns no bonus in the
-- worth bank and the guard trims the extra coins).

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
           sum(case b ->> 'merge' when '21' then 2 * 0.1 when '12' then 2 * 0.1 when '2' then 4 * 0.25 when '42' then 8 * 0.35 when '24' then 8 * 0.35 when '4' then 16 * 0.5 else 0 end) as want
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
