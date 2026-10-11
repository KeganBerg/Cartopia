-- Global chat and crew chat (src/lib/chat.ts, src/ui/Chat.tsx).
--   * chat_messages holds the last week of messages for two kinds of room: 'global' (every
--     signed-in player) and 'crew:<clan id>' (that crew's members only).
--   * Players never touch the table: chat_send() checks the room, the word filter (chat_ok, built
--     on name_ok and the same lists as names.ts), length and the rate limit, stores the message and broadcasts
--     it on the private Realtime topic 'chat:<room>'. chat_recent() returns a room's history.
--   * Realtime: signed-in players may listen on chat:global, and on chat:crew:<id> only while
--     they belong to that crew. Nobody may post on chat:* topics directly, so a broadcast always
--     comes from chat_send().
--   * chat_name() is the one place that decides the name chat shows (the town name for now;
--     switch it to usernames when they land).
--   * chat_banned: add an owner_id here in the SQL editor to stop someone chatting.
-- Standalone: no econ_catalog/econ_guard change. Safe to run before the game update.

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null check (room = 'global' or room ~ '^crew:[0-9a-f-]{36}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_room on public.chat_messages (room, id desc);
create index if not exists chat_messages_owner on public.chat_messages (owner_id, created_at desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;

create table if not exists public.chat_banned (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now()
);
alter table public.chat_banned enable row level security;
revoke all on public.chat_banned from anon, authenticated;

-- The name other players see next to a message.
create or replace function public.chat_name(p_uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select g.town_name from public.game_saves g where g.owner_id = p_uid), 'New driver')
$$;
revoke all on function public.chat_name(uuid) from public, anon, authenticated;

-- One message as the game reads it: who sent it, their level and crew badge.
create or replace function public.chat_json(m public.chat_messages) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'room', m.room, 'owner', m.owner_id, 'body', m.body, 'at', m.created_at,
    'name', public.chat_name(m.owner_id),
    'level', coalesce((select g.level from public.game_saves g where g.owner_id = m.owner_id), 1),
    'tag', c.tag, 'emblem', c.emblem, 'color', c.color)
  from (select 1) one
  left join public.clan_members cm on cm.owner_id = m.owner_id
  left join public.clans c on c.id = cm.clan_id
$$;
revoke all on function public.chat_json(public.chat_messages) from public, anon, authenticated;

-- Whether the signed-in player may read and write a room.
create or replace function public.chat_room_ok(p_room text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_room = 'global'
    or exists (select 1 from public.clan_members cm
               where cm.owner_id = auth.uid() and p_room = 'crew:' || cm.clan_id::text))
$$;
revoke all on function public.chat_room_ok(text) from public, anon;
grant execute on function public.chat_room_ok(text) to authenticated;

-- The word filter for a chat line: name_ok() on each word, and on runs of one- or two-letter
-- words joined up (so "f u c k" is caught but "push it" isn't read as one word). Same as
-- isCleanChat() in src/lib/names.ts.
create or replace function public.chat_ok(p_body text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  w text;
  run text := '';
begin
  foreach w in array regexp_split_to_array(btrim(coalesce(p_body, '')), '\s+') loop
    if not public.name_ok(w) then return false; end if;
    if char_length(w) <= 2 then
      run := run || w;
    else
      if not public.name_ok(run) then return false; end if;
      run := '';
    end if;
  end loop;
  return public.name_ok(run);
end $$;

-- Send a message. Raises: 'sign in', 'no save', 'not in that room', 'empty', 'too long',
-- 'not allowed' (word filter), 'muted', 'slow down', 'repeat'.
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
  if exists (select 1 from public.chat_banned b where b.owner_id = uid) then raise exception 'muted'; end if;
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

-- A room's latest 60 messages, oldest first.
create or replace function public.chat_recent(p_room text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.chat_room_ok(p_room) then raise exception 'not in that room'; end if;
  return coalesce((
    select jsonb_agg(public.chat_json(m) order by m.id)
    from (select * from public.chat_messages c where c.room = p_room
          and c.created_at > now() - interval '7 days' order by c.id desc limit 60) m), '[]'::jsonb);
end $$;
revoke all on function public.chat_recent(text) from public, anon;
grant execute on function public.chat_recent(text) to authenticated;

-- Realtime: listen only, and only to rooms you belong to.
drop policy if exists "players listen to their chat rooms" on realtime.messages;
create policy "players listen to their chat rooms" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'chat:%'
    and public.chat_room_ok(substr(realtime.topic(), 6)));
