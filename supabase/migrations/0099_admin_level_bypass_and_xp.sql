-- 0099: the admin account skips the car level lock, and admin grants give or take XP (needs 0090,
-- 0094 and 0097).
--
-- 1. econ_guard sends back a newly bought car above the player's level unless car_granted() says the
--    car was granted. It now also says yes when the saving account passes public.is_admin() (KBerg's
--    uid in public.admins, aal2 once MFA is on). The guard runs as the saving player, so auth.uid() is
--    the save's owner: no other account's level lock changes. The car still costs its coins and gems
--    (the worth and gem checks are untouched). Otherwise 0090's car_granted.
-- 2. admin_grant (0097) also takes XP: any whole number, added to the player's lifetime XP and turned
--    back into level and XP with econ_level_for(), the guard's own curve, between level 1 and level 200
--    (the guard's top). Taking XP never lowers the level (guard_game_save refuses level drops): it
--    stops at the start of the current level. The save and the game_saves.level column both
--    change; the write is security definer, so the next save's guard starts from it. Replaces 0097's
--    5-argument admin_grant; every new argument has a default, so the live client's calls still work.

create or replace function econ_private.car_granted(u text, m text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.crate_opens o where o.owner_id = auth.uid() and o.car_uid = u and o.model = m
                 and (o.kind = 'car' or o.kind = 'piece'))
      or exists (select 1 from public.purchases p where p.owner_id = auth.uid() and p.car = m
                 and 'pk-' || p.seq = u and p.reversed_at is null)
      or public.is_admin()
$$;
revoke all on function econ_private.car_granted(text, text) from public, anon;
grant execute on function econ_private.car_granted(text, text) to authenticated;

drop function if exists public.admin_grant(uuid, numeric, numeric, numeric, text);

create or replace function public.admin_grant(p_uid uuid, p_coins numeric, p_gems numeric, p_parts numeric default 0,
                                              p_reason text default null, p_xp numeric default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  why text := public.admin_reason(p_reason);
  top constant numeric := 1e12;
  top_xp constant numeric := public.econ_total_xp(200, 0);
  dc numeric := trunc(coalesce(p_coins, 0));
  dg numeric := trunc(coalesce(p_gems, 0));
  dp numeric := trunc(coalesce(p_parts, 0));
  dx numeric := trunc(coalesce(p_xp, 0));
  st jsonb;
  c0 numeric; b0 numeric; p0 numeric; c1 numeric; b1 numeric; p1 numeric;
  l0 int; x0 numeric; t0 numeric; t1 numeric; l1 int; x1 numeric;
begin
  if dc = 'NaN'::numeric or dg = 'NaN'::numeric or dp = 'NaN'::numeric or dx = 'NaN'::numeric then
    raise exception 'bad amount' using errcode = 'check_violation';
  end if;
  if dc = 0 and dg = 0 and dp = 0 and dx = 0 then raise exception 'nothing' using errcode = 'check_violation'; end if;
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_uid::text));
  select state into st from public.game_saves where owner_id = p_uid for update;
  if st is null then raise exception 'no save' using errcode = 'no_data_found'; end if;
  c0 := greatest(public.econ_num(st, 'coins'), 0); b0 := greatest(public.econ_num(st, 'bucks'), 0); p0 := greatest(public.econ_num(st, 'parts'), 0);
  c1 := least(greatest(c0 + dc, 0), top); b1 := least(greatest(b0 + dg, 0), top); p1 := least(greatest(p0 + dp, 0), top);
  l0 := least(greatest(floor(public.econ_num(st, 'level')), 1), 200)::int;
  x0 := greatest(public.econ_num(st, 'xp'), 0);
  if dx = 0 then
    l1 := l0; x1 := x0;
  else
    t0 := public.econ_total_xp(l0, x0);
    t1 := least(greatest(t0 + dx, public.econ_total_xp(l0, 0)), greatest(top_xp, t0));
    select l.lvl, l.xp into l1, x1 from public.econ_level_for(t1) l;
  end if;
  update public.game_saves
     set state = st || jsonb_build_object('coins', c1, 'bucks', b1, 'parts', p1)
                    || case when dx = 0 then '{}'::jsonb else jsonb_build_object('level', l1, 'xp', x1) end,
         level = case when dx = 0 then level else l1 end,
         updated_at = now()
   where owner_id = p_uid;
  perform public.admin_note(me, 'grant', p_uid, jsonb_build_object('reason', why, 'coins', c1 - c0, 'gems', b1 - b0, 'parts', p1 - p0)
    || case when dx = 0 then '{}'::jsonb else jsonb_build_object('xp', coalesce(t1 - t0, 0), 'levels', l1 - l0) end
    || jsonb_build_object('before', jsonb_build_object('coins', c0, 'gems', b0, 'parts', p0, 'level', l0, 'xp', x0),
                          'after', jsonb_build_object('coins', c1, 'gems', b1, 'parts', p1, 'level', l1, 'xp', x1)));
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_grant(uuid, numeric, numeric, numeric, text, numeric) from public, anon;
grant execute on function public.admin_grant(uuid, numeric, numeric, numeric, text, numeric) to authenticated;
