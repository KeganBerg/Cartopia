-- Usernames and a real friends list (src/lib/profiles.ts, src/lib/friendsList.ts, src/ui/Friends.tsx).
--   * profiles.username: one username per account, separate from the town name. 3 to 16 letters,
--     digits or _, unique ignoring case, through name_ok() like crew names. Set it once for free;
--     after that it can change once every 30 days (changing only the capitals is always free).
--     Everyone can read usernames; only set_username() writes them.
--   * friendships: one row per pair (a < b). A request is 'pending' until the other player
--     accepts or declines it. A declined request looks like it is still waiting to the sender,
--     and they can't send it again for 7 days. Players never touch the table directly.
--   * Limits: 100 friends, 30 requests waiting at once, 25 new requests a day.
-- No catalog or guard change. Safe to run before the game update: nothing calls it yet.

-- The first schema's profiles table (0001_init.sql) already has a row per account (made by the
-- on_auth_user_created trigger) and a username column nobody has used, so it holds usernames now.
-- Existing rows are left as they are: the new check only applies to names set from here on.
alter table public.profiles add column if not exists username_changed_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,16}$') not valid;
  end if;
end $$;
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
drop policy if exists "own profile writable" on public.profiles;
drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all" on public.profiles for select using (true);

-- Matches usernameProblem() in src/lib/profiles.ts (profiles.test.ts checks the lists agree).
create or replace function public.username_ok(p_name text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_name, '') ~ '^[A-Za-z0-9_]{3,16}$'
    and public.name_ok(replace(p_name, '_', ' '))
    -- reserved:begin
    and lower(p_name) <> all (array['admin', 'administrator', 'cartopia', 'mod', 'moderator', 'support', 'staff', 'official', 'system', 'rusty', 'help', 'null', 'undefined'])
    -- reserved:end
$$;

-- Returns 'ok', 'taken', 'bad', 'same', 'wait:<days>' or 'no'.
create or replace function public.set_username(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n text := trim(coalesce(p_name, ''));
  cur public.profiles;
  days int;
begin
  if me is null then return 'no'; end if;
  if not public.username_ok(n) then return 'bad'; end if;
  select * into cur from public.profiles where id = me;
  if found and cur.username is not null then
    if cur.username = n then return 'same'; end if;
    if lower(cur.username) <> lower(n) and cur.username_changed_at > now() - interval '30 days' then
      days := ceil(extract(epoch from (cur.username_changed_at + interval '30 days' - now())) / 86400);
      return 'wait:' || days;
    end if;
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(n) and id <> me) then
    return 'taken';
  end if;
  begin
    insert into public.profiles (id, username, username_changed_at) values (me, n, now())
    on conflict (id) do update set username = excluded.username,
      username_changed_at = case when lower(public.profiles.username) = lower(excluded.username)
                                 then public.profiles.username_changed_at else now() end;
  exception when unique_violation then
    return 'taken';
  end;
  return 'ok';
end $$;

-- Live check while typing: true when nobody else has it.
create or replace function public.username_free(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.username_ok(trim(p_name)) and not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(p_name)) and id is distinct from auth.uid());
$$;

create table if not exists public.friendships (
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  requester uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (a, b),
  check (a < b),
  check (requester = a or requester = b)
);
create index if not exists friendships_b on public.friendships (b);
create index if not exists friendships_requester on public.friendships (requester, created_at);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

-- Send a friend request to a player. Returns 'sent', 'accepted' (they had already asked you),
-- 'already' (friends), 'pending' (already asked), 'limit', 'no_name' (pick a username first) or 'no'.
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
      if (select count(*) from public.friendships where (a = me or b = me) and status = 'accepted') >= 100 then return 'limit'; end if;
      update public.friendships set status = 'accepted', responded_at = now() where a = lo and b = hi;
      return 'accepted';
    end if;
    -- Declined: the sender waits a week; the one who declined can change their mind any time.
    if f.requester = me and f.responded_at > now() - interval '7 days' then return 'pending'; end if;
  end if;
  if (select count(*) from public.friendships where (a = me or b = me) and status = 'accepted') >= 100
     or (select count(*) from public.friendships where requester = me and status = 'pending') >= 30
     or (select count(*) from public.friendships where requester = me and created_at > now() - interval '1 day') >= 25 then
    return 'limit';
  end if;
  insert into public.friendships (a, b, requester) values (lo, hi, me)
  on conflict (a, b) do update set requester = me, status = 'pending', created_at = now(), responded_at = null;
  return 'sent';
end $$;

-- The same, by username. Returns friend_request()'s answers, or 'not_found'.
create or replace function public.friend_request_name(p_username text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  them uuid;
begin
  select id into them from public.profiles where lower(username) = lower(trim(coalesce(p_username, '')));
  if them is null then return 'not_found'; end if;
  return public.friend_request(them);
end $$;

-- Accept or decline a request someone sent you. Returns 'accepted', 'declined', 'limit' or 'no'.
create or replace function public.friend_respond(p_from uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or p_from is null or p_from = me then return 'no'; end if;
  if not exists (select 1 from public.friendships where a = least(me, p_from) and b = greatest(me, p_from)
                 and requester = p_from and status = 'pending') then return 'no'; end if;
  if coalesce(p_accept, false)
     and (select count(*) from public.friendships where (a = me or b = me) and status = 'accepted') >= 100 then
    return 'limit';
  end if;
  update public.friendships set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end, responded_at = now()
  where a = least(me, p_from) and b = greatest(me, p_from);
  return case when coalesce(p_accept, false) then 'accepted' else 'declined' end;
end $$;

-- Unfriend, or call off a request you sent. A request someone sent you is declined instead.
create or replace function public.friend_remove(p_other uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or p_other is null then return false; end if;
  delete from public.friendships
  where a = least(me, p_other) and b = greatest(me, p_other)
    and (status = 'accepted' or requester = me);
  if found then return true; end if;
  return public.friend_respond(p_other, false) = 'declined';
end $$;

-- Your friends and requests, with what the Friends list shows of each player.
-- status: 'friend', 'incoming' (they asked you) or 'outgoing' (you asked them).
create or replace function public.friend_list()
returns table (other uuid, username text, town_name text, level int, best_car jsonb, status text, last_seen timestamptz, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, p.username, coalesce(s.town_name, 'Town'), coalesce(s.level, 1), s.best_car,
    case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'outgoing' else 'incoming' end,
    case when f.status = 'accepted' then s.updated_at end,
    coalesce(f.responded_at, f.created_at)
  from public.friendships f
  cross join lateral (select case when f.a = auth.uid() then f.b else f.a end as id) o
  left join public.profiles p on p.id = o.id
  left join public.game_saves s on s.owner_id = o.id
  where (f.a = auth.uid() or f.b = auth.uid())
    and not (f.status = 'declined' and f.requester <> auth.uid())
  order by 6, 3;
$$;

revoke execute on function public.set_username(text), public.username_free(text), public.friend_request(uuid),
  public.friend_request_name(text), public.friend_respond(uuid, boolean), public.friend_remove(uuid), public.friend_list() from public, anon;
grant execute on function public.set_username(text), public.username_free(text), public.friend_request(uuid),
  public.friend_request_name(text), public.friend_respond(uuid, boolean), public.friend_remove(uuid), public.friend_list() to authenticated;
grant execute on function public.username_ok(text) to anon, authenticated;
