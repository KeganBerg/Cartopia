-- Two-way friend help (src/lib/gifts.ts, src/ui/Gifts.tsx).
--   * Helping a friend's town leaves them a note: "Sam helped your town", worth a little fuel.
--   * Once a day each player can send each friend a gift of fuel or parts.
--   * Notes wait in friend_gifts until the owner collects them with claim_gifts().
-- Players never write the table themselves: every row goes through these functions, which fix
-- the amounts and the limits. Amounts match HELP_FUEL and GIFTS in src/lib/gifts.ts.
--   * One help and one gift per sender, per friend, per UTC day.
--   * A sender sends at most 10 gifts and 30 helps a day.
--   * An owner is paid for at most 10 notes a day; the rest wait for tomorrow.
-- What the client adds to the save still goes through econ_guard like any other gain.

create table if not exists public.friend_gifts (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('help', 'fuel', 'parts')),
  amount int not null check (amount between 0 and 100),
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  check (sender <> recipient)
);

-- A help and a gift are separate: one of each per pair per day.
create unique index if not exists friend_gifts_once_a_day on public.friend_gifts (sender, recipient, day, (kind = 'help'));
create index if not exists friend_gifts_inbox on public.friend_gifts (recipient, created_at) where claimed_at is null;
create index if not exists friend_gifts_sent on public.friend_gifts (sender, day);

alter table public.friend_gifts enable row level security;
revoke all on public.friend_gifts from anon, authenticated;

-- Leave a note for a friend whose town you just helped.
create or replace function public.friend_help(p_owner uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
begin
  if me is null or p_owner is null or p_owner = me then return false; end if;
  if not exists (select 1 from public.game_saves where owner_id = me)
     or not exists (select 1 from public.game_saves where owner_id = p_owner) then return false; end if;
  if (select count(*) from public.friend_gifts where sender = me and day = d and kind = 'help') >= 30 then return false; end if;
  insert into public.friend_gifts (sender, recipient, kind, amount, day) values (me, p_owner, 'help', 10, d)
  on conflict do nothing;
  return found;
end $$;

-- Send a friend today's gift: 'fuel' (15) or 'parts' (5).
-- Returns 'sent', 'already' (this friend got one from you today), 'limit' or 'no'.
create or replace function public.send_gift(p_to uuid, p_item text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
  amt int := case p_item when 'fuel' then 15 when 'parts' then 5 end;
begin
  if me is null or p_to is null or p_to = me or amt is null then return 'no'; end if;
  if not exists (select 1 from public.game_saves where owner_id = me)
     or not exists (select 1 from public.game_saves where owner_id = p_to) then return 'no'; end if;
  if exists (select 1 from public.friend_gifts where sender = me and recipient = p_to and day = d and kind <> 'help') then return 'already'; end if;
  if (select count(*) from public.friend_gifts where sender = me and day = d and kind <> 'help') >= 10 then return 'limit'; end if;
  insert into public.friend_gifts (sender, recipient, kind, amount, day) values (me, p_to, p_item, amt, d)
  on conflict do nothing;
  return case when found then 'sent' else 'already' end;
end $$;

-- Friends you already gifted today, so their gift button shows as sent.
create or replace function public.gifts_sent_today() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select recipient from public.friend_gifts
  where sender = auth.uid() and day = (now() at time zone 'utc')::date and kind <> 'help';
$$;

-- Notes waiting for you, newest first, with the sender's town name.
create or replace function public.gift_inbox()
returns table (id bigint, kind text, amount int, sender uuid, town_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, g.kind, g.amount, g.sender, coalesce(s.town_name, 'A friend'), g.created_at
  from public.friend_gifts g
  left join public.game_saves s on s.owner_id = g.sender
  where g.recipient = auth.uid() and g.claimed_at is null
  order by g.created_at desc
  limit 50;
$$;

-- Collect waiting notes, oldest first, up to today's limit. Returns what to add to the save.
create or replace function public.claim_gifts() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  room int;
  fuel int := 0;
  parts int := 0;
  n int := 0;
  r record;
begin
  if me is null then return jsonb_build_object('fuel', 0, 'parts', 0, 'count', 0, 'left', 0); end if;
  -- One claim at a time per player, so two tabs can't both be paid for the same notes.
  perform pg_advisory_xact_lock(hashtext('claim_gifts:' || me::text));
  room := 10 - (select count(*) from public.friend_gifts
                where recipient = me and claimed_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  for r in
    select id, kind, amount from public.friend_gifts
    where recipient = me and claimed_at is null
    order by created_at
    limit greatest(room, 0)
    for update
  loop
    update public.friend_gifts set claimed_at = now() where id = r.id;
    if r.kind = 'parts' then parts := parts + r.amount; else fuel := fuel + r.amount; end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('fuel', fuel, 'parts', parts, 'count', n,
    'left', (select count(*) from public.friend_gifts where recipient = me and claimed_at is null));
end $$;

revoke execute on function public.friend_help(uuid), public.send_gift(uuid, text), public.gifts_sent_today(),
  public.gift_inbox(), public.claim_gifts() from public, anon;
grant execute on function public.friend_help(uuid), public.send_gift(uuid, text), public.gifts_sent_today(),
  public.gift_inbox(), public.claim_gifts() to authenticated;
