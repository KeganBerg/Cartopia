-- Postcards and crew part requests (2026-10-13, Cartopia Build Order item 24; src/lib/postcards.ts,
-- src/lib/crewParts.ts). Run before the game update that shows them.
--
-- Postcards: a picture card and a set message (no free text, so nothing to moderate) sent to a
-- player who has a town. One card per sender per recipient per UTC day, and 20 sent a day.
-- Looks only: nothing is paid, so the save guard is untouched.
--   * send_postcard(to, card, msg) returns 'sent', 'already', 'limit' or 'no'.
--   * postcard_inbox() lists the last 14 days' cards, newest first, with the sender's town name.
--
-- Crew part requests: once a UTC day a crew member can ask their crew for 10 parts. Crewmates
-- give one part at a time (the giver's own save drops by one; the client does that, and a lower
-- count is never something the guard needs to stop), at most 5 to any one request and 20 a day.
-- The asker collects what has been given with claim_crew_parts(), which hands back the count to
-- add. Like friend gifts, that gain still goes through econ_guard; at most 10 parts a day per
-- player can come this way.
--   * ask_crew_parts() returns 'asked', 'already' or 'no' (not in a crew).
--   * crew_part_requests() lists today's requests in my crew, with names and what each has had.
--   * give_crew_part(request) returns 'given', 'full', 'limit', 'own' or 'no'.
--   * claim_crew_parts() returns how many parts to add.

create table if not exists public.postcards (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  card text not null check (card ~ '^[a-z]{2,16}$'),
  msg int not null check (msg between 0 and 31),
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create unique index if not exists postcards_once_a_day on public.postcards (sender, recipient, day);
create index if not exists postcards_inbox on public.postcards (recipient, created_at);
create index if not exists postcards_sent on public.postcards (sender, day);
alter table public.postcards enable row level security;
revoke all on public.postcards from anon, authenticated;

create or replace function public.send_postcard(p_to uuid, p_card text, p_msg int) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
begin
  if me is null or p_to is null or p_to = me or p_card !~ '^[a-z]{2,16}$' or p_msg is null or p_msg not between 0 and 31 then return 'no'; end if;
  if not exists (select 1 from public.game_saves where owner_id = me)
     or not exists (select 1 from public.game_saves where owner_id = p_to) then return 'no'; end if;
  if exists (select 1 from public.postcards where sender = me and recipient = p_to and day = d) then return 'already'; end if;
  if (select count(*) from public.postcards where sender = me and day = d) >= 20 then return 'limit'; end if;
  insert into public.postcards (sender, recipient, card, msg, day) values (me, p_to, p_card, p_msg, d)
  on conflict do nothing;
  return case when found then 'sent' else 'already' end;
end $$;

create or replace function public.postcard_inbox()
returns table (id bigint, card text, msg int, sender uuid, town_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.card, p.msg, p.sender, coalesce(s.town_name, 'A friend'), p.created_at
  from public.postcards p
  left join public.game_saves s on s.owner_id = p.sender
  where p.recipient = auth.uid() and p.created_at > now() - interval '14 days'
  order by p.created_at desc
  limit 30;
$$;

create table if not exists public.crew_part_requests (
  id bigint generated always as identity primary key,
  asker uuid not null references auth.users (id) on delete cascade,
  clan_id uuid not null references public.clans (id) on delete cascade,
  want int not null default 10 check (want between 1 and 20),
  claimed int not null default 0,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);
create unique index if not exists crew_part_requests_once_a_day on public.crew_part_requests (asker, day);
create index if not exists crew_part_requests_clan on public.crew_part_requests (clan_id, day);

create table if not exists public.crew_part_gifts (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.crew_part_requests (id) on delete cascade,
  giver uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);
create index if not exists crew_part_gifts_request on public.crew_part_gifts (request_id);
create index if not exists crew_part_gifts_giver on public.crew_part_gifts (giver, day);

alter table public.crew_part_requests enable row level security;
alter table public.crew_part_gifts enable row level security;
revoke all on public.crew_part_requests from anon, authenticated;
revoke all on public.crew_part_gifts from anon, authenticated;

create or replace function public.ask_crew_parts() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  crew uuid;
begin
  if me is null then return 'no'; end if;
  select clan_id into crew from public.clan_members where owner_id = me;
  if crew is null then return 'no'; end if;
  insert into public.crew_part_requests (asker, clan_id) values (me, crew) on conflict do nothing;
  return case when found then 'asked' else 'already' end;
end $$;

create or replace function public.crew_part_requests()
returns table (id bigint, asker uuid, town_name text, want int, given int, mine int, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.asker, coalesce(s.town_name, 'A crewmate'), r.want,
    (select count(*)::int from public.crew_part_gifts g where g.request_id = r.id),
    (select count(*)::int from public.crew_part_gifts g where g.request_id = r.id and g.giver = auth.uid()),
    r.created_at
  from public.crew_part_requests r
  left join public.game_saves s on s.owner_id = r.asker
  where r.clan_id = (select clan_id from public.clan_members where owner_id = auth.uid())
    and r.day = (now() at time zone 'utc')::date
  order by r.created_at desc;
$$;

create or replace function public.give_crew_part(p_request bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
  r public.crew_part_requests;
begin
  if me is null then return 'no'; end if;
  select * into r from public.crew_part_requests where id = p_request for update;
  if r.id is null or r.day <> d
     or r.clan_id is distinct from (select clan_id from public.clan_members where owner_id = me) then return 'no'; end if;
  if r.asker = me then return 'own'; end if;
  if (select count(*) from public.crew_part_gifts where request_id = r.id) >= r.want then return 'full'; end if;
  if (select count(*) from public.crew_part_gifts where request_id = r.id and giver = me) >= 5
     or (select count(*) from public.crew_part_gifts where giver = me and day = d) >= 20 then return 'limit'; end if;
  insert into public.crew_part_gifts (request_id, giver, day) values (r.id, me, d);
  return 'given';
end $$;

create or replace function public.claim_crew_parts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  got int := 0;
  r record;
begin
  if me is null then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('claim_crew_parts:' || me::text));
  for r in
    select q.id, q.claimed, (select count(*)::int from public.crew_part_gifts g where g.request_id = q.id) as given
    from public.crew_part_requests q
    where q.asker = me and q.created_at > now() - interval '7 days'
    for update
  loop
    if r.given > r.claimed then
      update public.crew_part_requests set claimed = r.given where id = r.id;
      got := got + r.given - r.claimed;
    end if;
  end loop;
  return got;
end $$;

revoke execute on function public.send_postcard(uuid, text, int), public.postcard_inbox(),
  public.ask_crew_parts(), public.crew_part_requests(), public.give_crew_part(bigint), public.claim_crew_parts() from public, anon;
grant execute on function public.send_postcard(uuid, text, int), public.postcard_inbox(),
  public.ask_crew_parts(), public.crew_part_requests(), public.give_crew_part(bigint), public.claim_crew_parts() to authenticated;
