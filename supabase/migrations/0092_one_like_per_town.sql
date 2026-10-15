-- One like per town (src/lib/meet.ts, src/ui/Meet.tsx). Replaces 0030's once-per-UTC-day rule:
--   * A player can like another player's town (Car Meet display / visit banner) once, ever.
--   * Still no liking your own town, still at most 40 likes handed out per UTC day.
--   * Guests (anonymous sign-ins) can't like.
-- Repeat likes from earlier days are removed (the first one is kept) so counts are one per player,
-- and a unique (liker, owner) index makes a second like impossible even from a direct API call.
-- Safe to run before or after the client ships: the RPC names and return values are unchanged.

delete from public.car_meet_likes l
using public.car_meet_likes k
where k.liker = l.liker and k.owner = l.owner
  and (k.day, k.created_at) < (l.day, l.created_at);

create unique index if not exists car_meet_likes_once on public.car_meet_likes (liker, owner);

-- Like a player's town. Returns 'liked', 'already' (you liked it before), 'limit' or 'no'.
create or replace function public.like_display(p_owner uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
begin
  if me is null or p_owner is null or p_owner = me then return 'no'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return 'no'; end if;
  if not exists (select 1 from public.game_saves where owner_id = me)
     or not exists (select 1 from public.game_saves where owner_id = p_owner) then return 'no'; end if;
  if exists (select 1 from public.car_meet_likes where liker = me and owner = p_owner) then return 'already'; end if;
  if (select count(*) from public.car_meet_likes where liker = me and day = d) >= 40 then return 'limit'; end if;
  insert into public.car_meet_likes (liker, owner, day) values (me, p_owner, d) on conflict do nothing;
  return case when found then 'liked' else 'already' end;
end $$;

-- Like counts for up to 60 towns (one per player), and whether you already liked each one.
create or replace function public.meet_likes(p_owners uuid[])
returns table (owner uuid, likes int, liked boolean)
language sql stable security definer set search_path = '' as $$
  select o,
    (select count(distinct l.liker)::int from public.car_meet_likes l where l.owner = o and l.liker <> o),
    exists (select 1 from public.car_meet_likes l where l.owner = o and l.liker = auth.uid())
  from unnest(p_owners[1:60]) as o;
$$;

revoke execute on function public.like_display(uuid), public.meet_likes(uuid[]) from public, anon;
grant execute on function public.like_display(uuid), public.meet_likes(uuid[]) to authenticated;
