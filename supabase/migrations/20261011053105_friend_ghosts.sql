-- Friend ghost races (src/lib/ghosts.ts, src/ui/GhostRace.tsx). Visit a friend's town, race the
-- ghost of their best run, then leave them a preset taunt they see the next time they play.
--   * A player's ghost is their fastest server-kept time: from these races or from any weekly time
--     trial (0026). Players with no time yet race as a par time for their best car.
--   * Runs are timed like time trial runs: ghost_start before the countdown, ghost_submit after the
--     line, the time can't beat the wall clock between them, and it is raised to
--     public.race_floor() of the server's best_car PI.
--   * Taunts are picked from a fixed list (TAUNTS in src/lib/ghosts.ts; ghosts.test.ts checks the
--     ids): no free text. Brag taunts only after a win. One taunt per run, 3 per friend and 20 in
--     all per UTC day.
-- Standalone: no change to econ_catalog() or econ_guard(), and no prizes.

create table if not exists public.ghost_runs (
  owner_id uuid primary key references auth.users on delete cascade,
  best_t numeric,
  pi int,
  car text,
  set_at timestamptz,
  -- The run in progress and whose ghost it is against.
  started_at timestamptz,
  vs uuid,
  -- The last finished run, which a taunt is about.
  last_vs uuid,
  last_t numeric,
  last_their numeric,
  last_won boolean,
  last_at timestamptz,
  taunted boolean not null default false
);
alter table public.ghost_runs enable row level security;
revoke all on public.ghost_runs from anon, authenticated;

create table if not exists public.ghost_taunts (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users on delete cascade,
  recipient uuid not null references auth.users on delete cascade,
  taunt smallint not null,
  won boolean not null,
  t numeric not null,
  their_t numeric,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  check (sender <> recipient)
);
create index if not exists ghost_taunts_inbox on public.ghost_taunts (recipient, created_at) where seen_at is null;
create index if not exists ghost_taunts_sent on public.ghost_taunts (sender, day);
alter table public.ghost_taunts enable row level security;
revoke all on public.ghost_taunts from anon, authenticated;

-- Taunt ids: brag ones need a win, good-sport ones go any time.
create or replace function public.ghost_taunt_ids() returns jsonb
language sql immutable set search_path = '' as $$
-- taunts:begin
select $taunts${"brag":[0,1,2,3,4,5],"any":[10,11,12,13]}$taunts$::jsonb
-- taunts:end
$$;

-- A player's best server-kept time from ghost races and time trials, and the car it was set in.
create or replace function public.ghost_best(who uuid) returns table (t numeric, pi int, car text)
language sql stable security definer set search_path = '' as $$
  select b.t, b.pi, b.car from (
    select g.best_t t, g.pi, g.car, g.set_at at from public.ghost_runs g where g.owner_id = who and g.best_t is not null
    union all
    select x.best_t, x.pi, x.car, x.set_at from public.time_trials x where x.owner_id = who and x.best_t is not null
  ) b order by b.t, b.at limit 1
$$;

-- The time a player's ghost runs: their best, or a par for their best car when they have none.
create or replace function public.ghost_target(who uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select b.t from public.ghost_best(who) b),
    (select round(public.race_floor((g.best_car ->> 'pi')::int) * 1.3, 2) from public.game_saves g where g.owner_id = who and g.best_car ? 'pi'))
$$;

-- What a friend's ghost looks like: time (null: no car yet), whether it's a par, and their car.
create or replace function public.ghost_of(p_owner uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    't', public.ghost_target(p_owner),
    'par', not exists (select 1 from public.ghost_best(p_owner)),
    'car', coalesce((select b.car from public.ghost_best(p_owner) b), g.best_car ->> 'name'),
    'pi', coalesce((select b.pi from public.ghost_best(p_owner) b), (g.best_car ->> 'pi')::int),
    'body', g.best_car ->> 'body',
    'color', g.best_car ->> 'color',
    'town', g.town_name)
  from public.game_saves g where g.owner_id = p_owner
$$;

-- Called as a run's countdown starts.
create or replace function public.ghost_start(p_vs uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  prev timestamptz;
begin
  if me is null then
    raise exception 'sign in to race ghosts' using errcode = 'insufficient_privilege';
  end if;
  if p_vs is null or p_vs = me or not exists (select 1 from public.game_saves g where g.owner_id = p_vs) then
    raise exception 'no such friend' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.game_saves g where g.owner_id = me and g.best_car ? 'pi') then
    raise exception 'no saved car' using errcode = 'no_data_found';
  end if;
  select started_at into prev from public.ghost_runs where owner_id = me;
  if prev > now() - interval '3 seconds' then
    raise exception 'slow down' using errcode = 'check_violation';
  end if;
  insert into public.ghost_runs as r (owner_id, started_at, vs) values (me, now(), p_vs)
  on conflict (owner_id) do update set started_at = now(), vs = p_vs;
end $$;

-- A finished run's time. Keeps my best and says whether I beat my friend's ghost.
create or replace function public.ghost_submit(t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.ghost_runs;
  best jsonb;
  my_pi int;
  kept numeric;
  their numeric;
  won boolean;
begin
  if me is null then
    raise exception 'sign in to race ghosts' using errcode = 'insufficient_privilege';
  end if;
  if t is null or t <= 0 or t > 120 then
    raise exception 'bad time' using errcode = 'check_violation';
  end if;
  select * into r from public.ghost_runs where owner_id = me for update;
  if r.started_at is null or now() - r.started_at < make_interval(secs => t::double precision) or now() - r.started_at > interval '3 minutes' then
    raise exception 'no run to finish' using errcode = 'check_violation';
  end if;
  select g.best_car into best from public.game_saves g where g.owner_id = me;
  my_pi := (best ->> 'pi')::int;
  kept := round(greatest(t, public.race_floor(coalesce(my_pi, 0))), 3);
  -- Their ghost as it stood when the run started (my own new best can't change theirs).
  their := public.ghost_target(r.vs);
  won := their is not null and kept < their;
  update public.ghost_runs set
    best_t = case when best_t is null or kept < best_t then kept else best_t end,
    pi = case when best_t is null or kept < best_t then my_pi else pi end,
    car = case when best_t is null or kept < best_t then left(best ->> 'name', 40) else car end,
    set_at = case when best_t is null or kept < best_t then now() else set_at end,
    started_at = null, vs = null,
    last_vs = r.vs, last_t = kept, last_their = their, last_won = won, last_at = now(), taunted = false
  where owner_id = me;
  return jsonb_build_object('kept', kept, 'their', their, 'won', won,
    'best', (select b.t from public.ghost_best(me) b));
end $$;

-- Leave a preset taunt for the friend from my last run. Returns 'sent', 'limit' or 'no'.
create or replace function public.ghost_taunt(p_taunt int) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'utc')::date;
  r public.ghost_runs;
  ids jsonb := public.ghost_taunt_ids();
begin
  if me is null or p_taunt is null then return 'no'; end if;
  select * into r from public.ghost_runs where owner_id = me for update;
  if r.last_vs is null or r.taunted or r.last_at < now() - interval '10 minutes' then return 'no'; end if;
  if not (ids -> 'any' @> to_jsonb(p_taunt) or (r.last_won and ids -> 'brag' @> to_jsonb(p_taunt))) then return 'no'; end if;
  if (select count(*) from public.ghost_taunts where sender = me and day = d) >= 20
     or (select count(*) from public.ghost_taunts where sender = me and recipient = r.last_vs and day = d) >= 3 then
    return 'limit';
  end if;
  insert into public.ghost_taunts (sender, recipient, taunt, won, t, their_t, day)
  values (me, r.last_vs, p_taunt, r.last_won, r.last_t, r.last_their, d);
  update public.ghost_runs set taunted = true where owner_id = me;
  return 'sent';
end $$;

-- Taunts waiting for me from the last week, newest first.
create or replace function public.taunt_inbox() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'from', x.sender, 'town', g.town_name, 'taunt', x.taunt,
    'won', x.won, 't', x.t, 'their', x.their_t, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
  from (
    select * from public.ghost_taunts
    where recipient = auth.uid() and seen_at is null and created_at > now() - interval '7 days'
    order by created_at desc limit 20
  ) x left join public.game_saves g on g.owner_id = x.sender
$$;

create or replace function public.taunts_seen(p_ids bigint[]) returns void
language sql security definer set search_path = '' as $$
  update public.ghost_taunts set seen_at = now() where recipient = auth.uid() and id = any(p_ids) and seen_at is null
$$;

revoke execute on function public.ghost_taunt_ids(), public.ghost_best(uuid), public.ghost_target(uuid), public.ghost_of(uuid),
  public.ghost_start(uuid), public.ghost_submit(numeric), public.ghost_taunt(int), public.taunt_inbox(), public.taunts_seen(bigint[]) from public, anon;
grant execute on function public.ghost_of(uuid), public.ghost_start(uuid), public.ghost_submit(numeric), public.ghost_taunt(int),
  public.taunt_inbox(), public.taunts_seen(bigint[]) to authenticated;
-- Guests can race a town's ghost too; their times stay on their device.
grant execute on function public.ghost_of(uuid) to anon;
