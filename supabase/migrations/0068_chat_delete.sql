-- Deleting chat messages (src/lib/chat.ts deleteChat, src/ui/Chat.tsx).
--   * Anyone can delete their own messages, in global and crew chat.
--   * A crew leader can delete any message in their crew's chat.
--   * Chat mods (chat_mods) can delete any message in any room. Seeded with Kegan's accounts below;
--     add someone in the SQL editor:
--       insert into public.chat_mods (owner_id) select id from public.profiles where lower(username) = 'name';
--   * chat_delete() removes the row and broadcasts 'del' {id} on chat:<room>, so the message goes
--     away live for everyone in the room. Players still never touch chat_messages directly.
--   * chat_powers() tells the game who may delete what, so it only offers Delete where it works.
-- Standalone: no econ_catalog/econ_guard change. Run BEFORE the game update that adds Delete.

create table if not exists public.chat_mods (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.chat_mods enable row level security;
revoke all on public.chat_mods from anon, authenticated;

insert into public.chat_mods (owner_id)
select u.id from auth.users u where lower(u.email) = 'keganbergeron@gmail.com'
union
select p.id from public.profiles p where lower(p.username) = 'kberg'
on conflict do nothing;

create or replace function public.chat_is_mod(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_uid is not null and exists (select 1 from public.chat_mods m where m.owner_id = p_uid)
$$;
revoke all on function public.chat_is_mod(uuid) from public, anon, authenticated;

-- Whether p_uid leads the crew whose chat room is p_room.
create or replace function public.chat_is_room_leader(p_uid uuid, p_room text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_uid is not null and exists (
    select 1 from public.clan_members cm
    where cm.owner_id = p_uid and cm.role = 'leader' and p_room = 'crew:' || cm.clan_id::text)
$$;
revoke all on function public.chat_is_room_leader(uuid, text) from public, anon, authenticated;

-- What the signed-in player may delete: {"mod": any message anywhere, "leader": any message in their crew room}.
create or replace function public.chat_powers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'mod', public.chat_is_mod(auth.uid()),
    'leader', exists (select 1 from public.clan_members cm where cm.owner_id = auth.uid() and cm.role = 'leader'))
$$;
revoke all on function public.chat_powers() from public, anon;
grant execute on function public.chat_powers() to authenticated;

-- Delete one message. Raises: 'sign in', 'gone' (already deleted or too old), 'not yours'.
create or replace function public.chat_delete(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.chat_messages;
begin
  if uid is null then raise exception 'sign in'; end if;
  select * into m from public.chat_messages c where c.id = p_id;
  if not found then raise exception 'gone'; end if;
  if m.owner_id <> uid
     and not public.chat_is_mod(uid)
     and not (m.room <> 'global' and public.chat_is_room_leader(uid, m.room)) then
    raise exception 'not yours';
  end if;
  delete from public.chat_messages c where c.id = m.id;
  perform realtime.send(jsonb_build_object('id', m.id), 'del', 'chat:' || m.room, true);
end $$;
revoke all on function public.chat_delete(bigint) from public, anon;
grant execute on function public.chat_delete(bigint) to authenticated;
