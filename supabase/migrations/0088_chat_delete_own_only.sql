-- Chat delete, own messages only (Kegan 2026-10-14: "users can't delete other users messages").
-- Replaces chat_delete() from 0068 without the crew-leader rule: a player deletes only their own
-- messages; chat mods (chat_mods, KBerg) still delete anything. chat_powers() stops reporting
-- 'leader'. Standalone, no econ_catalog/econ_guard change. Safe to run any time: the older game
-- only offered leaders a Delete that the server now refuses.

create or replace function public.chat_powers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('mod', public.chat_is_mod(auth.uid()))
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
     and not public.chat_is_mod(uid) then
    raise exception 'not yours';
  end if;
  delete from public.chat_messages c where c.id = m.id;
  perform realtime.send(jsonb_build_object('id', m.id), 'del', 'chat:' || m.room, true);
end $$;
revoke all on function public.chat_delete(bigint) from public, anon;
grant execute on function public.chat_delete(bigint) to authenticated;

drop function if exists public.chat_is_room_leader(uuid, text);
