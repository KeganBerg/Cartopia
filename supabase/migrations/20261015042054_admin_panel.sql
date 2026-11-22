-- Admin panel (2026-10-15, "Admin panel" thread; number assigned by economy). The in-game 🛡 panel
-- (src/ui/Admin.tsx) for Kegan's KBerg account: live events, a server banner, chat moderation, player
-- lookup, and granting or taking coins, gems and cars.
--   * Needs 0094_kberg_lockdown.sql: who is an admin is public.admins (by auth uid) and public.is_admin()
--     (aal2 once the account has two-step sign-in). Never email, username or anything the client sends.
--   * Every admin_* RPC is SECURITY DEFINER and starts with admin_gate(), which raises 'not allowed'
--     unless public.is_admin().
--   * Every change (live events, saves, chat) is written to public.admin_log with the admin's uid
--     (nobody can read it but the SQL editor and admin_log_recent()).
--   * Save changes (coins, gems, cars) are trusted writes, the same path purchase_reverse() uses: the
--     guard keeps them as written and restarts that save's banks, and updated_at moves, so an open game's
--     next save misses and it reloads the server town. Balances never go below 0.
--   * Chat: chat_banned gains `until` (null = for good) and chat_send() honours it; nothing else in
--     chat_send changes from 0048.
-- Standalone: no econ_catalog/econ_guard change. Run after 0094 and BEFORE the game update (until it
-- runs, the panel's buttons just say Failed).

create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid,
  action text not null,
  target uuid,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists admin_log_at on public.admin_log (at desc);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

alter table public.chat_banned add column if not exists until timestamptz;

-- First line of every admin RPC: the caller's uid, or 'not allowed'.
create or replace function public.admin_gate() returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return auth.uid();
end $$;
revoke all on function public.admin_gate() from public, anon, authenticated;

create or replace function public.admin_note(p_admin uuid, p_action text, p_target uuid, p_detail jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_log (admin_id, action, target, detail) values (p_admin, p_action, p_target, coalesce(p_detail, '{}'::jsonb))
$$;
revoke all on function public.admin_note(uuid, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_reason(p_reason text) returns text
language plpgsql immutable set search_path = '' as $$
declare r text := btrim(coalesce(p_reason, ''));
begin
  if char_length(r) < 3 then raise exception 'reason' using errcode = 'check_violation'; end if;
  return left(r, 120);
end $$;
revoke all on function public.admin_reason(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- live events

-- Start a live event for everyone. Kinds: night, day, rave, weather (payload.kind), banner (payload.message).
-- An optional payload.message also shows once as a toast, as with live_event_start().
create or replace function public.admin_live_start(p_kind text, p_minutes int, p_payload jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  v_msg text := left(btrim(coalesce(p_payload ->> 'message', '')), 120);
  v_wx text := p_payload ->> 'kind';
  v_payload jsonb := jsonb_build_object('by', 'admin');
  v_id bigint;
begin
  if p_kind not in ('night', 'day', 'rave', 'weather', 'banner') then raise exception 'bad kind' using errcode = 'check_violation'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then raise exception 'bad minutes' using errcode = 'check_violation'; end if;
  if p_kind = 'weather' then
    if v_wx is null or v_wx not in ('clear', 'rain', 'storm', 'drizzle', 'fog', 'wind', 'snow', 'blizzard', 'mist', 'heat') then
      raise exception 'bad weather' using errcode = 'check_violation';
    end if;
    v_payload := v_payload || jsonb_build_object('kind', v_wx);
  end if;
  if p_kind = 'banner' and v_msg = '' then raise exception 'empty' using errcode = 'check_violation'; end if;
  if v_msg <> '' then
    if not public.chat_ok(v_msg) then raise exception 'not allowed words' using errcode = 'check_violation'; end if;
    v_payload := v_payload || jsonb_build_object('message', v_msg);
  end if;
  v_id := public.live_event_start(p_kind, p_minutes, v_payload);
  perform public.admin_note(me, 'live_start', null, jsonb_build_object('id', v_id, 'kind', p_kind, 'minutes', p_minutes, 'payload', v_payload));
  return v_id;
end $$;
revoke all on function public.admin_live_start(text, int, jsonb) from public, anon;
grant execute on function public.admin_live_start(text, int, jsonb) to authenticated;

-- End running events: one kind, or all of them (null).
create or replace function public.admin_live_end(p_kind text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  v_n int;
begin
  v_n := public.live_event_end(p_kind);
  perform public.admin_note(me, 'live_end', null, jsonb_build_object('kind', p_kind, 'ended', v_n));
  return v_n;
end $$;
revoke all on function public.admin_live_end(text) from public, anon;
grant execute on function public.admin_live_end(text) to authenticated;

-- ---------------------------------------------------------------- players

create or replace function public.admin_player_json(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'town', g.town_name, 'level', coalesce(g.level, 1),
    'coins', coalesce(floor(public.econ_num(g.state, 'coins')), 0),
    'gems', coalesce(floor(public.econ_num(g.state, 'bucks')), 0),
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

-- Up to 12 players by username, town name or exact uid.
create or replace function public.admin_find(p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  q text := btrim(coalesce(p_q, ''));
  pat text;
begin
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  pat := '%' || replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((
    select jsonb_agg(public.admin_player_json(x.id))
    from (select p.id from public.profiles p left join public.game_saves g on g.owner_id = p.id
          where p.id::text = lower(q) or lower(p.username) like pat or lower(g.town_name) like pat
          order by (lower(p.username) = lower(q)) desc, g.updated_at desc nulls last limit 12) x), '[]'::jsonb);
end $$;
revoke all on function public.admin_find(text) from public, anon;
grant execute on function public.admin_find(text) to authenticated;

-- One player, with their last 10 chat messages.
create or replace function public.admin_player(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.admin_gate();
begin
  return public.admin_player_json(p_uid) || jsonb_build_object('chat', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'room', m.room, 'body', m.body, 'at', m.created_at) order by m.id desc)
    from (select * from public.chat_messages c where c.owner_id = p_uid order by c.id desc limit 10) m), '[]'::jsonb));
end $$;
revoke all on function public.admin_player(uuid) from public, anon;
grant execute on function public.admin_player(uuid) to authenticated;

-- ---------------------------------------------------------------- saves

-- Add (or with a negative amount, take) coins and gems. Balances stop at 0.
create or replace function public.admin_grant(p_uid uuid, p_coins int, p_gems int, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  why text := public.admin_reason(p_reason);
  st jsonb;
  c0 numeric; b0 numeric; c1 numeric; b1 numeric;
begin
  if coalesce(p_coins, 0) = 0 and coalesce(p_gems, 0) = 0 then raise exception 'nothing' using errcode = 'check_violation'; end if;
  if abs(coalesce(p_coins, 0)) > 10000000 or abs(coalesce(p_gems, 0)) > 100000 then raise exception 'too much' using errcode = 'check_violation'; end if;
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_uid::text));
  select state into st from public.game_saves where owner_id = p_uid for update;
  if st is null then raise exception 'no save' using errcode = 'no_data_found'; end if;
  c0 := greatest(public.econ_num(st, 'coins'), 0); b0 := greatest(public.econ_num(st, 'bucks'), 0);
  c1 := greatest(c0 + coalesce(p_coins, 0), 0); b1 := greatest(b0 + coalesce(p_gems, 0), 0);
  update public.game_saves set state = st || jsonb_build_object('coins', c1, 'bucks', b1), updated_at = now() where owner_id = p_uid;
  perform public.admin_note(me, 'grant', p_uid, jsonb_build_object('reason', why, 'coins', c1 - c0, 'gems', b1 - b0,
    'before', jsonb_build_object('coins', c0, 'gems', b0), 'after', jsonb_build_object('coins', c1, 'gems', b1)));
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_grant(uuid, int, int, text) from public, anon;
grant execute on function public.admin_grant(uuid, int, int, text) to authenticated;

-- Give a car (any model the catalog knows), stock, in red.
create or replace function public.admin_give_car(p_uid uuid, p_model text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  why text := public.admin_reason(p_reason);
  st jsonb;
  car jsonb;
begin
  if p_model is null or not (public.econ_catalog() -> 'cars') ? p_model then raise exception 'bad car' using errcode = 'check_violation'; end if;
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_uid::text));
  select state into st from public.game_saves where owner_id = p_uid for update;
  if st is null then raise exception 'no save' using errcode = 'no_data_found'; end if;
  car := jsonb_build_object('uid', 'adm-' || replace(gen_random_uuid()::text, '-', ''), 'model', p_model, 'color', '#e53935',
    'upgrades', jsonb_build_object('engine', 0, 'turbo', 0, 'tires', 0, 'weight', 0));
  update public.game_saves
     set state = jsonb_set(st, '{cars}', (case when jsonb_typeof(st -> 'cars') = 'array' then st -> 'cars' else '[]' end) || jsonb_build_array(car)),
         updated_at = now()
   where owner_id = p_uid;
  perform public.admin_note(me, 'give_car', p_uid, jsonb_build_object('reason', why, 'model', p_model, 'uid', car ->> 'uid'));
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_give_car(uuid, text, text) from public, anon;
grant execute on function public.admin_give_car(uuid, text, text) to authenticated;

-- Take one car. Like selling it in game (store.ts sellCar), minus the coins: it leaves its building,
-- the meet display and the race slot. A player's last car stays.
create or replace function public.admin_take_car(p_uid uuid, p_car text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  why text := public.admin_reason(p_reason);
  st jsonb;
  cars jsonb;
  gone jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_uid::text));
  select state into st from public.game_saves where owner_id = p_uid for update;
  if st is null then raise exception 'no save' using errcode = 'no_data_found'; end if;
  cars := case when jsonb_typeof(st -> 'cars') = 'array' then st -> 'cars' else '[]' end;
  select x into gone from jsonb_array_elements(cars) x where x ->> 'uid' = p_car limit 1;
  if gone is null then raise exception 'no car' using errcode = 'no_data_found'; end if;
  if jsonb_array_length(cars) <= 1 then raise exception 'last car' using errcode = 'check_violation'; end if;
  st := jsonb_set(st, '{cars}', coalesce((select jsonb_agg(x) from jsonb_array_elements(cars) x where x ->> 'uid' is distinct from p_car), '[]'));
  if jsonb_typeof(st -> 'buildings') = 'array' then
    st := jsonb_set(st, '{buildings}', coalesce((select jsonb_agg(case when b ->> 'car' = p_car then b - 'car' else b end)
                                                 from jsonb_array_elements(st -> 'buildings') b), '[]'));
  end if;
  if jsonb_typeof(st -> 'showcase') = 'array' then
    st := jsonb_set(st, '{showcase}', coalesce((select jsonb_agg(u) from jsonb_array_elements(st -> 'showcase') u where u #>> '{}' is distinct from p_car), '[]'));
  end if;
  if st ->> 'raceCar' = p_car then st := jsonb_set(st, '{raceCar}', 'null'); end if;
  update public.game_saves set state = st, updated_at = now() where owner_id = p_uid;
  perform public.admin_note(me, 'take_car', p_uid, jsonb_build_object('reason', why, 'model', gone ->> 'model', 'uid', p_car, 'car', gone));
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_take_car(uuid, text, text) from public, anon;
grant execute on function public.admin_take_car(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- chat

-- Mute for p_minutes, or for good (null). Muting again replaces the old mute.
create or replace function public.admin_mute(p_uid uuid, p_minutes int, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  why text := public.admin_reason(p_reason);
  v_until timestamptz := case when p_minutes is null then null else now() + make_interval(mins => greatest(p_minutes, 1)) end;
begin
  if p_uid = me then raise exception 'not yourself' using errcode = 'check_violation'; end if;
  insert into public.chat_banned (owner_id, reason, until) values (p_uid, why, v_until)
  on conflict (owner_id) do update set reason = excluded.reason, until = excluded.until, created_at = now();
  perform public.admin_note(me, 'mute', p_uid, jsonb_build_object('reason', why, 'minutes', p_minutes));
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_mute(uuid, int, text) from public, anon;
grant execute on function public.admin_mute(uuid, int, text) to authenticated;

create or replace function public.admin_unmute(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.admin_gate();
begin
  delete from public.chat_banned where owner_id = p_uid;
  perform public.admin_note(me, 'unmute', p_uid, '{}');
  return public.admin_player_json(p_uid);
end $$;
revoke all on function public.admin_unmute(uuid) from public, anon;
grant execute on function public.admin_unmute(uuid) to authenticated;

-- Delete one message, or every message a player sent this week (p_id null), live for everyone.
create or replace function public.admin_chat_delete(p_uid uuid, p_id bigint default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  m record;
  n int := 0;
begin
  for m in delete from public.chat_messages c where c.owner_id = p_uid and (p_id is null or c.id = p_id) returning c.id, c.room, c.body loop
    perform realtime.send(jsonb_build_object('id', m.id), 'del', 'chat:' || m.room, true);
    n := n + 1;
    if p_id is not null then perform public.admin_note(me, 'chat_delete', p_uid, jsonb_build_object('id', m.id, 'body', m.body)); end if;
  end loop;
  if p_id is null then perform public.admin_note(me, 'chat_purge', p_uid, jsonb_build_object('deleted', n)); end if;
  return n;
end $$;
revoke all on function public.admin_chat_delete(uuid, bigint) from public, anon;
grant execute on function public.admin_chat_delete(uuid, bigint) to authenticated;

-- 0048's chat_send; only the 'muted' line changes, so a mute can run out.
create or replace function public.chat_send(p_room text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  m public.chat_messages;
  v_row jsonb;
begin
  if uid is null then raise exception 'sign in'; end if;
  if not exists (select 1 from public.game_saves g where g.owner_id = uid) then raise exception 'no save'; end if;
  if not public.chat_room_ok(p_room) then raise exception 'not in that room'; end if;
  if v_body = '' then raise exception 'empty'; end if;
  if char_length(v_body) > 200 then raise exception 'too long'; end if;
  if not public.chat_ok(v_body) then raise exception 'not allowed'; end if;
  if exists (select 1 from public.chat_banned b where b.owner_id = uid and (b.until is null or b.until > now())) then raise exception 'muted'; end if;
  -- At most 3 messages in 10 seconds and 15 a minute, across every room.
  if (select count(*) from public.chat_messages c where c.owner_id = uid and c.created_at > now() - interval '10 seconds') >= 3
     or (select count(*) from public.chat_messages c where c.owner_id = uid and c.created_at > now() - interval '1 minute') >= 15 then
    raise exception 'slow down';
  end if;
  if exists (select 1 from public.chat_messages c where c.owner_id = uid and c.room = p_room
             and c.created_at > now() - interval '1 minute' and lower(c.body) = lower(v_body)) then
    raise exception 'repeat';
  end if;

  insert into public.chat_messages (room, owner_id, body) values (p_room, uid, v_body) returning * into m;
  v_row := public.chat_json(m);
  perform realtime.send(v_row, 'msg', 'chat:' || p_room, true);
  -- Keep a week of history.
  if m.id % 50 = 0 then
    delete from public.chat_messages c where c.created_at < now() - interval '7 days';
  end if;
  return v_row;
end $$;
revoke all on function public.chat_send(text, text) from public, anon;
grant execute on function public.chat_send(text, text) to authenticated;

-- ---------------------------------------------------------------- log

create or replace function public.admin_log_recent() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.admin_gate();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'at', l.at, 'action', l.action, 'target', l.target,
      'name', (select p.username from public.profiles p where p.id = l.target), 'detail', l.detail) order by l.id desc)
    from (select * from public.admin_log x where x.action not in ('find', 'player', 'log') order by x.id desc limit 30) l), '[]'::jsonb);
end $$;
revoke all on function public.admin_log_recent() from public, anon;
grant execute on function public.admin_log_recent() to authenticated;
