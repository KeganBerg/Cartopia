-- Weekly time trial (src/game/trial.ts). One venue a week, solo runs, a board that resets every
-- Monday 00:00 UTC (public.this_week(), from 0004), and prizes for last week's places.
--   * A run must be started on the server (trial_start) before its time is accepted (trial_submit),
--     and the time can't be longer than the wall clock between the two allows.
--   * The car is the server's: game_saves.best_car, whose PI the economy guard checks. A time faster
--     than that PI can possibly run is raised to public.race_floor() (0009), the live race floors.
--   * Prizes are paid in the save and checked by econ_guard. Until the guard knows about them
--     (it calls public.trial_place), trial_prizes() reports them as not ready, so nobody claims
--     something the guard would trim.
-- Standalone: no change to econ_catalog() or econ_guard().

create table if not exists public.time_trials (
  week date not null,
  owner_id uuid not null references auth.users on delete cascade,
  best_t numeric,
  pi int,
  car text,
  runs int not null default 0,
  set_at timestamptz, -- when best_t was set; the earlier time wins a tie
  started_at timestamptz, -- the run in progress, cleared once its time is in
  primary key (week, owner_id)
);
create index if not exists time_trials_board on public.time_trials (week, best_t, set_at) where best_t is not null;
alter table public.time_trials enable row level security;
revoke all on public.time_trials from anon, authenticated;

-- Prize tiers, best place first (TRIAL_PRIZES in src/game/trial.ts; trial.test.ts keeps them in step).
create or replace function public.trial_prize_table() returns jsonb
language sql immutable set search_path = '' as $$
-- prizes:begin
select $prizes$[{"upTo":1,"bucks":10,"coins":10000,"trophies":5},{"upTo":2,"bucks":7,"coins":6000,"trophies":4},{"upTo":3,"bucks":5,"coins":4000,"trophies":3},{"upTo":10,"bucks":2,"coins":2000,"trophies":2},{"upTo":null,"bucks":0,"coins":500,"trophies":1}]$prizes$::jsonb
-- prizes:end
$$;

-- A player's final place on a finished week's board, or null (no time, or the week isn't over).
create or replace function public.trial_place(who uuid, wk date) returns int
language sql stable security definer set search_path = '' as $$
  select r.place from (
    select owner_id, (rank() over (order by best_t, set_at))::int as place
    from public.time_trials where week = wk and best_t is not null
  ) r
  where r.owner_id = who and wk < public.this_week()
$$;

-- The prize for a place (an element of trial_prize_table()).
create or replace function public.trial_prize(place int) returns jsonb
language sql immutable set search_path = '' as $$
  select p from jsonb_array_elements(public.trial_prize_table()) p
  where p ->> 'upTo' is null or place <= (p ->> 'upTo')::int
  limit 1
$$;

-- Called as a run's countdown starts.
create or replace function public.trial_start() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.this_week();
  prev timestamptz;
begin
  if me is null then
    raise exception 'sign in to post times' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.game_saves g where g.owner_id = me and g.best_car ? 'pi') then
    raise exception 'no saved car' using errcode = 'no_data_found';
  end if;
  select started_at into prev from public.time_trials where week = wk and owner_id = me;
  if prev > now() - interval '3 seconds' then
    raise exception 'slow down' using errcode = 'check_violation';
  end if;
  insert into public.time_trials as t (week, owner_id, runs, started_at) values (wk, me, 1, now())
  on conflict (week, owner_id) do update set runs = t.runs + 1, started_at = now();
end $$;

-- What the board looks like to me: the top 20, my place and time, and how many have run.
create or replace function public.trial_board() returns jsonb
language sql stable security definer set search_path = '' as $$
  with board as (
    select t.owner_id, t.best_t, t.pi, t.car, (rank() over (order by t.best_t, t.set_at))::int as place
    from public.time_trials t where t.week = public.this_week() and t.best_t is not null
  )
  select jsonb_build_object(
    'week', public.this_week(),
    'total', (select count(*) from board),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('owner', b.owner_id, 'town', g.town_name, 't', b.best_t, 'pi', b.pi, 'car', b.car, 'place', b.place) order by b.place)
      from (select * from board order by place limit 20) b
      left join public.game_saves g on g.owner_id = b.owner_id), '[]'::jsonb),
    'me', (select jsonb_build_object('t', b.best_t, 'place', b.place) from board b where b.owner_id = auth.uid()))
$$;

-- A finished run's time. Keeps the player's best, and returns the board.
create or replace function public.trial_submit(t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.this_week();
  r public.time_trials;
  best jsonb;
  my_pi int;
  kept numeric;
begin
  if me is null then
    raise exception 'sign in to post times' using errcode = 'insufficient_privilege';
  end if;
  if t is null or t <= 0 or t > 120 then
    raise exception 'bad time' using errcode = 'check_violation';
  end if;
  select * into r from public.time_trials where week = wk and owner_id = me for update;
  -- No run started this week, the time is longer than the run lasted, or the run went stale.
  if r.started_at is null or now() - r.started_at < make_interval(secs => t::double precision) or now() - r.started_at > interval '3 minutes' then
    raise exception 'no run to finish' using errcode = 'check_violation';
  end if;
  select g.best_car into best from public.game_saves g where g.owner_id = me;
  my_pi := (best ->> 'pi')::int;
  kept := round(greatest(t, public.race_floor(coalesce(my_pi, 0))), 3);
  if r.best_t is null or kept < r.best_t then
    update public.time_trials set best_t = kept, pi = my_pi, car = left(best ->> 'name', 40), set_at = now(), started_at = null
    where week = wk and owner_id = me;
  else
    update public.time_trials set started_at = null where week = wk and owner_id = me;
  end if;
  return public.trial_board() || jsonb_build_object('kept', kept);
end $$;

-- Prizes from the last eight weeks that my save hasn't claimed yet. ready is false until econ_guard
-- checks trial claims (it calls trial_place), so the client holds them until then.
create or replace function public.trial_prizes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  claimed jsonb;
begin
  if me is null then
    return jsonb_build_object('ready', false, 'prizes', '[]'::jsonb);
  end if;
  select coalesce(g.state -> 'trials' -> 'claimed', '{}'::jsonb) into claimed from public.game_saves g where g.owner_id = me;
  return jsonb_build_object(
    'ready', pg_get_functiondef('public.econ_guard()'::regprocedure) like '%trial_place%',
    'prizes', coalesce((
      select jsonb_agg(jsonb_build_object('week', w.week, 'place', w.place, 't', w.best_t) order by w.week)
      from (
        select t.week, t.best_t, public.trial_place(me, t.week) as place
        from public.time_trials t
        where t.owner_id = me and t.best_t is not null and t.week < public.this_week() and t.week >= public.this_week() - 56
      ) w
      where w.place is not null and not coalesce(claimed, '{}'::jsonb) ? w.week::text), '[]'::jsonb));
end $$;

revoke execute on function public.trial_start(), public.trial_submit(numeric), public.trial_board(), public.trial_prizes(),
  public.trial_place(uuid, date), public.trial_prize(int), public.trial_prize_table() from public, anon;
-- trial_place, trial_prize and trial_prize_table are for econ_guard, which runs as the saving player.
grant execute on function public.trial_start(), public.trial_submit(numeric), public.trial_board(), public.trial_prizes(),
  public.trial_place(uuid, date), public.trial_prize(int), public.trial_prize_table() to authenticated;
-- Guests can look at the board.
grant execute on function public.trial_board() to anon;
