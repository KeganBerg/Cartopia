-- Friend cap for both players (follow-up to 0049_friends_usernames.sql).
-- friend_request() and friend_respond() only checked the caller's 100-friend cap, so a player
-- already at 100 could still gain friends when someone else sent or accepted a request.
-- Both now check the other player too. Same signatures and grants; safe to run any time after 0049.

create or replace function public.friend_request(p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  lo uuid := least(me, p_to);
  hi uuid := greatest(me, p_to);
  f public.friendships;
begin
  if me is null or p_to is null or p_to = me then return 'no'; end if;
  if not exists (select 1 from public.profiles where id = me and username is not null) then return 'no_name'; end if;
  if not exists (select 1 from public.game_saves where owner_id = p_to) then return 'no'; end if;
  select * into f from public.friendships where a = lo and b = hi for update;
  if found then
    if f.status = 'accepted' then return 'already'; end if;
    if f.status = 'pending' and f.requester = me then return 'pending'; end if;
    if f.status = 'pending' then
      if (select count(*) from public.friendships where (a = me or b = me) and status = 'accepted') >= 100
         or (select count(*) from public.friendships where (a = p_to or b = p_to) and status = 'accepted') >= 100 then return 'limit'; end if;
      update public.friendships set status = 'accepted', responded_at = now() where a = lo and b = hi;
      return 'accepted';
    end if;
    -- Declined: the sender waits a week; the one who declined can change their mind any time.
    if f.requester = me and f.responded_at > now() - interval '7 days' then return 'pending'; end if;
  end if;
  if (select count(*) from public.friendships where (a = me or b = me) and status = 'accepted') >= 100
     or (select count(*) from public.friendships where (a = p_to or b = p_to) and status = 'accepted') >= 100
     or (select count(*) from public.friendships where requester = me and status = 'pending') >= 30
     or (select count(*) from public.friendships where requester = me and created_at > now() - interval '1 day') >= 25 then
    return 'limit';
  end if;
  insert into public.friendships (a, b, requester) values (lo, hi, me)
  on conflict (a, b) do update set requester = me, status = 'pending', created_at = now(), responded_at = null;
  return 'sent';
end $$;

create or replace function public.friend_respond(p_from uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or p_from is null or p_from = me then return 'no'; end if;
  if not exists (select 1 from public.friendships where a = least(me, p_from) and b = greatest(me, p_from)
                 and requester = p_from and status = 'pending') then return 'no'; end if;
  if coalesce(p_accept, false)
     and ((select count(*) from public.friendships where (a = me or b = me) and status = 'accepted') >= 100
          or (select count(*) from public.friendships where (a = p_from or b = p_from) and status = 'accepted') >= 100) then
    return 'limit';
  end if;
  update public.friendships set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end, responded_at = now()
  where a = least(me, p_from) and b = greatest(me, p_from);
  return case when coalesce(p_accept, false) then 'accepted' else 'declined' end;
end $$;
