-- 0096: the admin panel gives or takes any amount of coins and gems (needs 0095).
--
-- admin_grant took int amounts capped at 10M coins and 100k gems. It now takes any whole number.
-- A balance tops out at 1 trillion (1e12): econ_num() reads every save number capped there, so
-- econ_guard would cut a bigger balance back to 1e12 on the player's first purchase. At 1e12 the
-- balance saves, shows ("1T") and spends normally, and is exact in the client's JS numbers.
-- Still is_admin() only (admin_gate), still logged with the amount actually given or taken.

drop function if exists public.admin_grant(uuid, int, int, text);

create or replace function public.admin_grant(p_uid uuid, p_coins numeric, p_gems numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  why text := public.admin_reason(p_reason);
  top constant numeric := 1e12;
  dc numeric := trunc(coalesce(p_coins, 0));
  dg numeric := trunc(coalesce(p_gems, 0));
  st jsonb;
  c0 numeric; b0 numeric; c1 numeric; b1 numeric;
begin
  if dc = 'NaN'::numeric or dg = 'NaN'::numeric then raise exception 'bad amount' using errcode = 'check_violation'; end if;
  if dc = 0 and dg = 0 then raise exception 'nothing' using errcode = 'check_violation'; end if;
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_uid::text));
  select state into st from public.game_saves where owner_id = p_uid for update;
  if st is null then raise exception 'no save' using errcode = 'no_data_found'; end if;
  c0 := greatest(public.econ_num(st, 'coins'), 0); b0 := greatest(public.econ_num(st, 'bucks'), 0);
  c1 := least(greatest(c0 + dc, 0), top); b1 := least(greatest(b0 + dg, 0), top);
  update public.game_saves set state = st || jsonb_build_object('coins', c1, 'bucks', b1), updated_at = now() where owner_id = p_uid;
  perform public.admin_note(me, 'grant', p_uid, jsonb_build_object('reason', why, 'coins', c1 - c0, 'gems', b1 - b0,
    'before', jsonb_build_object('coins', c0, 'gems', b0), 'after', jsonb_build_object('coins', c1, 'gems', b1)));
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_grant(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.admin_grant(uuid, numeric, numeric, text) to authenticated;
