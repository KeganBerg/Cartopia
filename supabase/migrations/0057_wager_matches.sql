-- Wager matches (2026-10-12): two signed-in players stake coins on a live drag race.
-- Coins only; gems are never staked. Standalone: replaces no existing function and doesn't
-- touch econ_guard() or econ_catalog(). Writes no new ids into saves, so it can run before
-- the client; until it runs the game just hides the wager button (wager_offer is missing).
--
--   * The challenger names a stake (wager_offer) right after claiming the race (race_join).
--     Stakes and the level both racers need come from STAKES in src/game/wager.ts.
--   * Accepting (wager_accept) holds the stake from BOTH players on the server, after checking
--     each one's saved coins cover it. A hold, a win (2x stake) and a refund (1x stake) are rows
--     in wager_ledger, numbered per player.
--   * When the referee decides the race (live_races.winner or void, from 0009), the winner is
--     paid both stakes; a void race refunds both. A held race nobody finishes is voided after
--     5 minutes by wager_sync().
--   * Saves: the page adds ledger rows to its coins and counts them in the save's `wagers`.
--     Two triggers keep the guard out of it: "econ_a_wager_claims" (fires before econ_guard, as
--     before-triggers run in name order) takes the claimed rows' coins back out so the guard only
--     sees play, and "econ_wagers" (fires after econ_guard and econ_progress) puts them back.
--     Rows a page hasn't claimed two minutes on are applied there anyway (a closed tab, or a page
--     that skips a loss), and the page reloads the server copy.

create table if not exists public.wagers (
  race_id text primary key references public.live_races on delete cascade,
  a uuid not null references auth.users on delete cascade, -- the challenger
  b uuid not null references auth.users on delete cascade,
  stake int not null check (stake > 0),
  status text not null default 'offered' check (status in ('offered', 'held', 'settled')),
  created_at timestamptz not null default now(),
  held_at timestamptz
);
alter table public.wagers enable row level security;
drop policy if exists "racers read their wagers" on public.wagers;
create policy "racers read their wagers" on public.wagers for select using (auth.uid() in (a, b));
revoke insert, update, delete on public.wagers from anon, authenticated;
grant select on public.wagers to authenticated;
create index if not exists wagers_held_a_idx on public.wagers (a) where status = 'held';
create index if not exists wagers_held_b_idx on public.wagers (b) where status = 'held';

create table if not exists public.wager_ledger (
  owner_id uuid not null references auth.users on delete cascade,
  seq int not null check (seq > 0),
  race_id text not null,
  delta bigint not null,
  kind text not null check (kind in ('hold', 'win', 'refund')),
  created_at timestamptz not null default now(),
  primary key (owner_id, seq)
);
alter table public.wager_ledger enable row level security;
drop policy if exists "players read their wager ledger" on public.wager_ledger;
create policy "players read their wager ledger" on public.wager_ledger for select using (auth.uid() = owner_id);
revoke insert, update, delete on public.wager_ledger from anon, authenticated;
grant select on public.wager_ledger to authenticated;

-- A stake both racers may bet at level `lvl` (the lower of the two).
create or replace function econ_private.wager_stake_ok(stake int, lvl int) returns boolean
language sql immutable set search_path = '' as $$
-- stakes:begin
select exists (select 1 from jsonb_array_elements($stakes$[[500,1],[2000,3],[10000,8],[50000,15],[250000,25]]$stakes$::jsonb) x
               where (x ->> 0)::int = stake and (x ->> 1)::int <= lvl)
-- stakes:end
$$;

-- A player's coins as the server sees them: the saved coins plus ledger rows the save hasn't counted.
create or replace function econ_private.wager_coins(who uuid) returns numeric
language sql stable set search_path = '' as $$
  select public.econ_num(g.state, 'coins')
       + coalesce((select sum(l.delta) from public.wager_ledger l
                   where l.owner_id = who and l.seq > floor(public.econ_num(g.state, 'wagers'))), 0)
  from public.game_saves g where g.owner_id = who
$$;

create or replace function econ_private.wager_post(who uuid, race text, amount bigint, what text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('wager_ledger:' || who::text));
  insert into public.wager_ledger (owner_id, seq, race_id, delta, kind)
  select who, coalesce(max(l.seq), 0) + 1, race, amount, what from public.wager_ledger l where l.owner_id = who;
end $$;

-- The challenger's stake, right after race_join and before the challenge goes out.
create or replace function public.wager_offer(race_id text, stake int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.live_races;
  lvl int;
begin
  select * into r from public.live_races x where x.id = race_id;
  if me is null or r.id is null or r.a <> me or r.created_at < now() - interval '2 minutes' then
    raise exception 'not your race' using errcode = 'insufficient_privilege';
  end if;
  select min(g.level) into lvl from public.game_saves g where g.owner_id in (r.a, r.b);
  if not econ_private.wager_stake_ok(stake, coalesce(lvl, 0)) then
    raise exception 'stake not allowed' using errcode = 'check_violation';
  end if;
  if coalesce(econ_private.wager_coins(me), 0) < stake then
    raise exception 'not enough coins' using errcode = 'check_violation';
  end if;
  insert into public.wagers (race_id, a, b, stake) values (r.id, r.a, r.b, stake);
end $$;

-- Accepting a wager challenge holds both stakes. `stake` is what the challenge said, so a
-- challenger can't show one stake and offer another. Fails (and the challenge should be declined)
-- when it doesn't match or either player can't cover it any more.
create or replace function public.wager_accept(race_id text, stake int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  w public.wagers;
begin
  select * into w from public.wagers x where x.race_id = wager_accept.race_id for update;
  if me is null or w.race_id is null or w.b <> me or w.status <> 'offered' or w.created_at < now() - interval '90 seconds'
     or w.stake is distinct from wager_accept.stake then
    raise exception 'wager expired' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(econ_private.wager_coins(w.b), 0) < w.stake then
    raise exception 'not enough coins' using errcode = 'check_violation';
  end if;
  if coalesce(econ_private.wager_coins(w.a), 0) < w.stake then
    raise exception 'challenger short of coins' using errcode = 'check_violation';
  end if;
  perform econ_private.wager_post(w.a, w.race_id, -w.stake, 'hold');
  perform econ_private.wager_post(w.b, w.race_id, -w.stake, 'hold');
  update public.wagers x set status = 'held', held_at = now() where x.race_id = w.race_id;
end $$;

-- Pays out once the referee decides the race.
create or replace function econ_private.wager_settle() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  w public.wagers;
begin
  if (new.winner is not null or new.void) and old.winner is null and not old.void then
    update public.wagers x set status = 'settled' where x.race_id = new.id and x.status = 'held' returning * into w;
    if w.race_id is not null then
      if new.winner is null then
        perform econ_private.wager_post(w.a, w.race_id, w.stake, 'refund');
        perform econ_private.wager_post(w.b, w.race_id, w.stake, 'refund');
      else
        perform econ_private.wager_post(new.winner, w.race_id, 2::bigint * w.stake, 'win');
      end if;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists wager_settle on public.live_races;
create trigger wager_settle after update on public.live_races
  for each row execute function econ_private.wager_settle();

-- Called by the game on load and after a wager race: calls held races of yours that are over.
create or replace function public.wager_sync() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  w record;
  r public.live_races;
begin
  if me is null then return; end if;
  for w in select x.race_id from public.wagers x
           where x.status = 'held' and (x.a = me or x.b = me) and x.held_at < now() - interval '5 minutes' loop
    r := public.race_decide(w.race_id);
    if r.winner is null and not r.void then
      update public.live_races x set void = true where x.id = w.race_id;
    end if;
  end loop;
end $$;

-- Save triggers -----------------------------------------------------------------------------------
-- The save's `wagers` is the last ledger row its coins include: never lower than before, never past
-- the ledger. Claimed rows' coins come out before econ_guard and go back in after it.
create or replace function econ_private.wager_claims_out() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o_n int := greatest(floor(public.econ_num(old.state, 'wagers')), 0)::int;
  n int := greatest(floor(public.econ_num(new.state, 'wagers')), 0)::int;
  top int;
  net numeric;
begin
  if not (old.state ? 'wagers' or new.state ? 'wagers') then return new; end if;
  select coalesce(max(l.seq), 0) into top from public.wager_ledger l where l.owner_id = new.owner_id;
  n := least(greatest(n, o_n), greatest(top, o_n));
  new.state := jsonb_set(new.state, '{wagers}', to_jsonb(n));
  if n > o_n then
    select coalesce(sum(l.delta), 0) into net from public.wager_ledger l
      where l.owner_id = new.owner_id and l.seq > o_n and l.seq <= n;
    new.state := jsonb_set(new.state, '{coins}', to_jsonb(public.econ_num(new.state, 'coins') - net));
  end if;
  return new;
end $$;

create or replace function econ_private.wager_claims_in() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o_n int := greatest(floor(public.econ_num(old.state, 'wagers')), 0)::int;
  n int := greatest(floor(public.econ_num(new.state, 'wagers')), 0)::int;
  late int;
  net numeric := 0;
begin
  -- Rows left unclaimed for two minutes are applied here.
  select max(l.seq) into late from public.wager_ledger l
    where l.owner_id = new.owner_id and l.seq > n and l.created_at < now() - interval '2 minutes';
  if late is not null then
    new.corrections := coalesce(new.corrections, '{}') || jsonb_build_object('wagers', jsonb_build_object('sent', n, 'kept', late));
    n := late;
  end if;
  if n <= o_n then return new; end if;
  select coalesce(sum(l.delta), 0) into net from public.wager_ledger l
    where l.owner_id = new.owner_id and l.seq > o_n and l.seq <= n;
  new.state := jsonb_set(new.state, '{wagers}', to_jsonb(n));
  new.state := jsonb_set(new.state, '{coins}', to_jsonb(greatest(floor(public.econ_num(new.state, 'coins') + net), 0)));
  return new;
end $$;

-- Before-triggers fire in name order: econ_a_wager_claims < econ_bounds < ... < econ_guard < econ_progress < econ_wagers.
drop trigger if exists econ_a_wager_claims on public.game_saves;
create trigger econ_a_wager_claims before update on public.game_saves
  for each row execute function econ_private.wager_claims_out();
drop trigger if exists econ_wagers on public.game_saves;
create trigger econ_wagers before update on public.game_saves
  for each row execute function econ_private.wager_claims_in();

revoke execute on function econ_private.wager_stake_ok(int, int), econ_private.wager_coins(uuid),
  econ_private.wager_post(uuid, text, bigint, text), econ_private.wager_settle(),
  econ_private.wager_claims_out(), econ_private.wager_claims_in() from public, anon, authenticated;
revoke execute on function public.wager_offer(text, int), public.wager_accept(text, int), public.wager_sync() from public, anon;
grant execute on function public.wager_offer(text, int), public.wager_accept(text, int), public.wager_sync() to authenticated;
