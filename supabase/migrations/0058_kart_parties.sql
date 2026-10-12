-- Kart parties: live kart races for 3 to 6 players (the 1v1 kart race still uses live_races).
-- Every browser runs the whole race and drives its own kart (the host also drives the AI
-- fillers); this table is the referee for the players' placings:
--   * the host opens the party with the players who accepted (host first, 2..6 players),
--   * each player joins it (the server notes their real PI from their save),
--   * each reports a finish time, which can't beat the fastest time a kart could manage,
--   * places go by time once every player who joined has reported, or 60 seconds after the
--     first report (anyone still out finishes behind everyone who reported).
-- The race's private Realtime topic is party:<id>, open only to the party's players.
-- Signed-in players only. Writes no ids into saves; nothing to run in any particular order
-- except that this goes in before the client that calls it ships.

create table if not exists public.kart_parties (
  id text primary key check (length(id) between 8 and 64),
  host uuid not null references auth.users on delete cascade,
  players uuid[] not null check (cardinality(players) between 2 and 6),
  pis int[] not null default '{}', -- per player (same order), null until they join
  times numeric[] not null default '{}', -- per player, null until they report
  first_at timestamptz, -- when the first time came in
  done boolean not null default false,
  created_at timestamptz not null default now(),
  check (players[1] = host)
);
alter table public.kart_parties enable row level security;
drop policy if exists "party players read their party" on public.kart_parties;
create policy "party players read their party" on public.kart_parties for select using ((select auth.uid()) = any (players));
revoke all on public.kart_parties from anon, authenticated;
grant select on public.kart_parties to authenticated;

-- Three laps of the shortest circuit flat out on a rocket: no real finish is faster.
create or replace function public.kart_floor() returns numeric
language sql immutable set search_path = '' as $$ select 25::numeric $$;

-- What a player sees: whether it's settled, their place among the players, everyone's times.
create or replace function public.kart_party_view(p public.kart_parties, me uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  mine int := array_position(p.players, me);
  my_t numeric := p.times[mine];
  place int;
begin
  -- Players with a better time (or any time, when we have none) finish ahead of us; a tie
  -- goes to whoever is earlier in the list.
  select 1 + count(*) into place
    from generate_subscripts(p.players, 1) i
    where i <> mine and p.times[i] is not null
      and (my_t is null or p.times[i] < my_t or (p.times[i] = my_t and i < mine));
  return jsonb_build_object(
    'done', p.done,
    'place', place,
    'of', cardinality(p.players),
    'my_t', my_t,
    'times', to_jsonb(p.times));
end $$;

-- The host opens the party (creating it, or nothing if it's already theirs).
create or replace function public.kart_party_open(party_id text, guests uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p public.kart_parties;
begin
  if me is null or guests is null or cardinality(guests) not between 1 and 5 or me = any (guests)
     or (select count(distinct g) from unnest(guests) g) <> cardinality(guests) or array_position(guests, null) is not null then
    raise exception 'bad party' using errcode = 'insufficient_privilege';
  end if;
  insert into public.kart_parties (id, host, players, pis, times)
    values (party_id, me, array[me] || guests, array_fill(null::int, array[1 + cardinality(guests)]), array_fill(null::numeric, array[1 + cardinality(guests)]))
    on conflict (id) do nothing;
  select * into p from public.kart_parties where id = party_id;
  if p.host <> me or p.created_at < now() - interval '10 minutes' then
    raise exception 'not your party' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Every player (the host too) joins when the race starts; the server keeps their PI.
create or replace function public.kart_party_join(party_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p public.kart_parties;
  i int;
  my_pi int;
begin
  select * into p from public.kart_parties where id = party_id for update;
  i := array_position(p.players, me);
  if p.id is null or me is null or i is null or p.created_at < now() - interval '10 minutes' then
    raise exception 'not your party' using errcode = 'insufficient_privilege';
  end if;
  select (g.best_car ->> 'pi')::int into my_pi from public.game_saves g where g.owner_id = me;
  if my_pi is null then
    raise exception 'no saved car to race' using errcode = 'no_data_found';
  end if;
  if p.pis[i] is null then
    p.pis[i] := my_pi;
    update public.kart_parties set pis = p.pis where id = party_id;
  end if;
end $$;

-- Settles the party once everyone who joined has a time, or a minute after the first time.
create or replace function public.kart_party_decide(party_id text) returns public.kart_parties
language plpgsql security definer set search_path = '' as $$
declare
  p public.kart_parties;
  waiting int;
begin
  select * into p from public.kart_parties where id = party_id for update;
  if not p.done and p.first_at is not null then
    select count(*) into waiting from generate_subscripts(p.players, 1) i where p.pis[i] is not null and p.times[i] is null;
    if waiting = 0 or p.first_at < now() - interval '60 seconds' then
      p.done := true;
      update public.kart_parties set done = true where id = party_id;
    end if;
  end if;
  return p;
end $$;

-- A player's finish time. Reporting again (a retry) keeps the first time.
create or replace function public.kart_party_finish(party_id text, t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p public.kart_parties;
  i int;
begin
  select * into p from public.kart_parties where id = party_id for update;
  i := array_position(p.players, me);
  if p.id is null or me is null or i is null or p.pis[i] is null then
    raise exception 'not your party' using errcode = 'insufficient_privilege';
  end if;
  if t is null or t <= 0 or t > 900 then
    raise exception 'bad time' using errcode = 'check_violation';
  end if;
  if not p.done and p.times[i] is null then
    p.times[i] := round(greatest(t, public.kart_floor()), 3);
    update public.kart_parties set times = p.times, first_at = coalesce(first_at, now()) where id = party_id;
  end if;
  return public.kart_party_view(public.kart_party_decide(party_id), me);
end $$;

-- Polled while waiting for the others.
create or replace function public.kart_party_status(party_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p public.kart_parties;
begin
  select * into p from public.kart_parties where id = party_id;
  if p.id is null or me is null or not me = any (p.players) then
    raise exception 'not your party' using errcode = 'insufficient_privilege';
  end if;
  return public.kart_party_view(public.kart_party_decide(party_id), me);
end $$;

revoke execute on function public.kart_party_open(text, uuid[]), public.kart_party_join(text), public.kart_party_finish(text, numeric),
  public.kart_party_status(text), public.kart_party_decide(text), public.kart_party_view(public.kart_parties, uuid), public.kart_floor() from public, anon;
grant execute on function public.kart_party_open(text, uuid[]), public.kart_party_join(text), public.kart_party_finish(text, numeric),
  public.kart_party_status(text) to authenticated;

-- The party's private channel: snapshots, items and the start, between its players only.
drop policy if exists "party players listen to their party" on realtime.messages;
create policy "party players listen to their party" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'party:%'
    and exists (select 1 from public.kart_parties p
                where p.id = substr(realtime.topic(), 7) and (select auth.uid()) = any (p.players)
                  and p.created_at > now() - interval '30 minutes'));

drop policy if exists "party players post to their party" on realtime.messages;
create policy "party players post to their party" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'party:%'
    and exists (select 1 from public.kart_parties p
                where p.id = substr(realtime.topic(), 7) and (select auth.uid()) = any (p.players)
                  and p.created_at > now() - interval '30 minutes'));
