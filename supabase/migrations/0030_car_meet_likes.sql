-- Car Meet likes (src/lib/meet.ts, src/ui/Meet.tsx).
--   * Players put up to three cars on show (state.showcase in game_saves, read like any save).
--   * Anyone signed in can like another player's display once per UTC day.
--   * A player can hand out at most 40 likes a day, and can't like their own display.
-- Likes are only a count: they pay nothing, so the economy guard is untouched.
-- Players never write the table themselves; every like goes through like_display().

create table if not exists public.car_meet_likes (
  liker uuid not null references auth.users (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  primary key (liker, owner, day),
  check (liker <> owner)
);

create index if not exists car_meet_likes_owner on public.car_meet_likes (owner);
create index if not exists car_meet_likes_day on public.car_meet_likes (liker, day);

alter table public.car_meet_likes enable row level security;
revoke all on public.car_meet_likes from anon, authenticated;

-- Like a player's display. Returns 'liked', 'already' (you liked it today), 'limit' or 'no'.
create or replace function public.like_display(p_owner uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
begin
  if me is null or p_owner is null or p_owner = me then return 'no'; end if;
  if not exists (select 1 from public.game_saves where owner_id = me)
     or not exists (select 1 from public.game_saves where owner_id = p_owner) then return 'no'; end if;
  if exists (select 1 from public.car_meet_likes where liker = me and owner = p_owner and day = d) then return 'already'; end if;
  if (select count(*) from public.car_meet_likes where liker = me and day = d) >= 40 then return 'limit'; end if;
  insert into public.car_meet_likes (liker, owner, day) values (me, p_owner, d) on conflict do nothing;
  return case when found then 'liked' else 'already' end;
end $$;

-- Like counts for up to 60 displays, and whether you already liked each one today.
create or replace function public.meet_likes(p_owners uuid[])
returns table (owner uuid, likes int, liked boolean)
language sql stable security definer set search_path = '' as $$
  select o,
    (select count(*)::int from public.car_meet_likes l where l.owner = o),
    exists (select 1 from public.car_meet_likes l
            where l.owner = o and l.liker = auth.uid() and l.day = (now() at time zone 'utc')::date)
  from unnest(p_owners[1:60]) as o;
$$;

revoke execute on function public.like_display(uuid), public.meet_likes(uuid[]) from public, anon;
grant execute on function public.like_display(uuid), public.meet_likes(uuid[]) to authenticated;
