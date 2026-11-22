-- Standalone: no change to econ_catalog(), econ_guard() or crates; prizes come in 0087.
--
-- Weekly arcade boards (src/lib/arcadeBoard.ts). One board per game per week, resetting Monday
-- 00:00 UTC (public.this_week(), from 0004). Parking Pro has none: its lots are a ladder, not a score.
--   * A run must be started on the server (arcade_start) before its result is accepted (arcade_submit).
--   * A result must be possible in the wall-clock time between the two, and under a hard cap per game.
--   * Pit Stop keeps the lowest time; the others keep the highest number.

create table if not exists public.arcade_scores (
  week date not null,
  game text not null check (game in ('chase', 'pit', 'wash', 'delivery', 'stunt')),
  owner_id uuid not null references auth.users on delete cascade,
  best numeric,
  runs int not null default 0,
  set_at timestamptz, -- when best was set; the earlier one wins a tie
  started_at timestamptz, -- the run in progress, cleared once its result is in
  primary key (week, game, owner_id)
);
create index if not exists arcade_scores_board on public.arcade_scores (week, game, best) where best is not null;
alter table public.arcade_scores enable row level security;
revoke all on public.arcade_scores from anon, authenticated;

-- Pit Stop is a time (lower wins); everything else is a count or a score (higher wins).
create or replace function public.arcade_low(g text) returns boolean
language sql immutable set search_path = '' as $$ select g = 'pit' $$;

-- Is this result possible from a run that lasted `secs` seconds? Caps are generous on purpose:
-- they stop made-up numbers, not good players (rules in src/game/arcade.ts and arcadeMore.ts).
create or replace function public.arcade_ok(g text, v numeric, secs numeric) returns boolean
language sql immutable set search_path = '' as $$
  select v is not null and v >= 0 and case g
    -- Distance, coins, near misses and smashes: well under 400 points a second, 250k at most.
    when 'chase' then v <= 400 * secs and v <= 250000
    -- A whole stop takes at least 4 seconds and can't take longer than the run.
    when 'pit' then v >= 4 and v <= secs and v <= 120
    -- A car a second at the very most.
    when 'wash' then v <= secs and v <= 60
    -- A delivery every 3 seconds at the very most.
    when 'delivery' then v <= secs / 3 and v <= 60
    -- Four jumps, each under 1,500 points, and a jump takes over 3 seconds (run-up, air, landing).
    when 'stunt' then v <= 6000 and v <= 1500 * floor(secs / 3)
    else false end
$$;

create or replace function public.arcade_start(g text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.this_week();
  prev timestamptz;
begin
  if me is null then
    raise exception 'sign in to post scores' using errcode = 'insufficient_privilege';
  end if;
  if g not in ('chase', 'pit', 'wash', 'delivery', 'stunt') then
    raise exception 'no such game' using errcode = 'check_violation';
  end if;
  select started_at into prev from public.arcade_scores where week = wk and game = g and owner_id = me;
  if prev > now() - interval '3 seconds' then
    raise exception 'slow down' using errcode = 'check_violation';
  end if;
  insert into public.arcade_scores as a (week, game, owner_id, runs, started_at) values (wk, g, me, 1, now())
  on conflict (week, game, owner_id) do update set runs = a.runs + 1, started_at = now();
end $$;

-- What one game's board looks like to me: the top 20, my place and best, and how many have played.
create or replace function public.arcade_board(g text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with board as (
    select a.owner_id, a.best,
      (rank() over (order by case when public.arcade_low(g) then a.best else -a.best end, a.set_at))::int as place
    from public.arcade_scores a where a.week = public.this_week() and a.game = g and a.best is not null
  )
  select jsonb_build_object(
    'week', public.this_week(),
    'game', g,
    'total', (select count(*) from board),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('owner', b.owner_id, 'town', s.town_name, 'best', b.best, 'place', b.place) order by b.place)
      from (select * from board order by place limit 20) b
      left join public.game_saves s on s.owner_id = b.owner_id), '[]'::jsonb),
    'me', (select jsonb_build_object('best', b.best, 'place', b.place) from board b where b.owner_id = auth.uid()))
$$;

-- A finished run's result. Keeps the player's best, and returns the board.
create or replace function public.arcade_submit(g text, v numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.this_week();
  r public.arcade_scores;
  secs numeric;
begin
  if me is null then
    raise exception 'sign in to post scores' using errcode = 'insufficient_privilege';
  end if;
  -- The run's own week, so a run that crosses Monday 00:00 UTC still counts (on the week it began).
  select * into r from public.arcade_scores where game = g and owner_id = me and started_at is not null and week >= wk - 7
  order by week desc limit 1 for update;
  wk := coalesce(r.week, wk);
  if r.started_at is null or now() - r.started_at > interval '10 minutes' then
    raise exception 'no run to finish' using errcode = 'check_violation';
  end if;
  secs := extract(epoch from now() - r.started_at);
  if not public.arcade_ok(g, v, secs) then
    update public.arcade_scores set started_at = null where week = wk and game = g and owner_id = me;
    raise exception 'bad result' using errcode = 'check_violation';
  end if;
  if r.best is null or (case when public.arcade_low(g) then v < r.best else v > r.best end) then
    update public.arcade_scores set best = v, set_at = now(), started_at = null where week = wk and game = g and owner_id = me;
  else
    update public.arcade_scores set started_at = null where week = wk and game = g and owner_id = me;
  end if;
  return public.arcade_board(g);
end $$;

revoke execute on function public.arcade_start(text), public.arcade_submit(text, numeric), public.arcade_board(text),
  public.arcade_ok(text, numeric, numeric), public.arcade_low(text) from public, anon;
grant execute on function public.arcade_start(text), public.arcade_submit(text, numeric), public.arcade_board(text) to authenticated;
grant execute on function public.arcade_board(text) to anon;

-- Prizes (a Gold crate for each week's top 3 per game) are 0087, by the economy thread.
