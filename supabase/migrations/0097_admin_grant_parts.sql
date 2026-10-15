-- 0097: the admin panel gives or takes parts too (needs 0096).
--
-- admin_grant (0096) takes coins and gems; it now also takes parts, with the same rules: any whole
-- number, a balance clamped to 0..1 trillion (econ_num()'s cap), logged. The write is server-side
-- (security definer), so the next save's econ_guard starts from the granted balance and keeps it.
-- Replaces 0096's 4-argument admin_grant; the player card now shows parts.

drop function if exists public.admin_grant(uuid, numeric, numeric, text);

-- The player card now shows parts too.
create or replace function public.admin_player_json(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'town', g.town_name, 'level', coalesce(g.level, 1),
    'coins', coalesce(floor(public.econ_num(g.state, 'coins')), 0),
    'gems', coalesce(floor(public.econ_num(g.state, 'bucks')), 0),
    'parts', coalesce(floor(public.econ_num(g.state, 'parts')), 0),
    'cars', coalesce((select jsonb_agg(jsonb_build_object('uid', x ->> 'uid', 'model', x ->> 'model', 'color', x ->> 'color'))
                      from jsonb_array_elements(case when jsonb_typeof(g.state -> 'cars') = 'array' then g.state -> 'cars' else '[]' end) x), '[]'::jsonb),
    'muted', (select coalesce(to_jsonb(b.until), 'true'::jsonb) from public.chat_banned b
              where b.owner_id = p.id and (b.until is null or b.until > now())),
    'admin', exists (select 1 from public.admins a where a.owner_id = p.id),
    'joined', p.created_at, 'seen', g.updated_at)
  from public.profiles p
  left join public.game_saves g on g.owner_id = p.id
  where p.id = p_uid
$$;
revoke all on function public.admin_player_json(uuid) from public, anon, authenticated;

create or replace function public.admin_grant(p_uid uuid, p_coins numeric, p_gems numeric, p_parts numeric default 0, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  why text := public.admin_reason(p_reason);
  top constant numeric := 1e12;
  dc numeric := trunc(coalesce(p_coins, 0));
  dg numeric := trunc(coalesce(p_gems, 0));
  dp numeric := trunc(coalesce(p_parts, 0));
  st jsonb;
  c0 numeric; b0 numeric; p0 numeric; c1 numeric; b1 numeric; p1 numeric;
begin
  if dc = 'NaN'::numeric or dg = 'NaN'::numeric or dp = 'NaN'::numeric then raise exception 'bad amount' using errcode = 'check_violation'; end if;
  if dc = 0 and dg = 0 and dp = 0 then raise exception 'nothing' using errcode = 'check_violation'; end if;
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_uid::text));
  select state into st from public.game_saves where owner_id = p_uid for update;
  if st is null then raise exception 'no save' using errcode = 'no_data_found'; end if;
  c0 := greatest(public.econ_num(st, 'coins'), 0); b0 := greatest(public.econ_num(st, 'bucks'), 0); p0 := greatest(public.econ_num(st, 'parts'), 0);
  c1 := least(greatest(c0 + dc, 0), top); b1 := least(greatest(b0 + dg, 0), top); p1 := least(greatest(p0 + dp, 0), top);
  update public.game_saves set state = st || jsonb_build_object('coins', c1, 'bucks', b1, 'parts', p1), updated_at = now() where owner_id = p_uid;
  perform public.admin_note(me, 'grant', p_uid, jsonb_build_object('reason', why, 'coins', c1 - c0, 'gems', b1 - b0, 'parts', p1 - p0,
    'before', jsonb_build_object('coins', c0, 'gems', b0, 'parts', p0), 'after', jsonb_build_object('coins', c1, 'gems', b1, 'parts', p1)));
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_grant(uuid, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.admin_grant(uuid, numeric, numeric, numeric, text) to authenticated;
