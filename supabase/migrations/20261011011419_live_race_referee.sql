-- Live race referee. Each player's browser still runs its own race and shows the rival from
-- broadcast samples, but the result comes from here:
--   * a player's PI is the server's (game_saves.best_car, checked by the economy guard),
--   * a reported finish time faster than that PI allows is raised to the fastest possible time,
--   * the lower time wins (a tie goes to the challenger); a player who joined but reports nothing
--     for 45 seconds after the other finished loses, and if they never joined the race doesn't count.
-- Signed-in players only; races with a guest stay unrefereed.

create table if not exists public.live_races (
  id text primary key check (length(id) between 8 and 64),
  a uuid not null references auth.users on delete cascade, -- the challenger
  b uuid not null references auth.users on delete cascade,
  a_pi int,
  b_pi int,
  a_t numeric,
  b_t numeric,
  a_at timestamptz,
  b_at timestamptz,
  winner uuid,
  forfeit boolean not null default false,
  void boolean not null default false, -- the other player never joined, so nobody wins
  created_at timestamptz not null default now(),
  check (a <> b)
);
alter table public.live_races enable row level security;
drop policy if exists "racers read their races" on public.live_races;
create policy "racers read their races" on public.live_races for select using (auth.uid() in (a, b));
revoke insert, update, delete on public.live_races from anon, authenticated;

-- Fastest finish for each PI (index = PI - 1), from raceFloor() in src/game/race.ts.
create or replace function public.race_floor(pi int) returns numeric
language sql immutable set search_path = '' as $$
-- floors:begin
select ($floors$[52.686,33.982,26.714,22.64,19.967,18.041,16.579,15.417,14.462,13.666,12.987,12.398,11.886,11.427,11.017,10.651,10.318,10.014,9.733,9.477,9.238,9.018,8.815,8.62,8.441,8.271,8.112,7.958,7.816,7.682,7.552,7.43,7.312,7.194,7.089,6.983,6.881,6.788,6.694,6.609,6.524,6.443,6.361,6.284,6.211,6.142,6.073,6.008,5.939,5.878,5.817,5.76,5.703,5.646,5.594,5.541,5.492,5.439,5.39,5.346,5.301,5.256,5.212,5.171,5.126,5.086,5.049,5.009,4.972,4.935,4.899,4.862,4.826,4.793,4.761,4.728,4.696,4.663,4.635,4.602,4.574,4.545,4.517,4.489,4.46,4.432,4.407,4.383,4.355,4.33,4.306,4.281,4.257,4.233,4.208,4.184,4.16,4.139,4.115,4.095,4.074,4.05,4.03,4.009,3.993,3.969,3.952,3.932,3.912,3.895,3.875,3.859,3.839,3.822,3.802,3.786,3.77,3.753,3.733,3.721,3.705,3.684,3.672,3.656,3.64,3.623,3.607,3.595,3.579,3.566,3.55,3.538,3.522,3.51,3.493,3.481,3.469,3.453,3.445,3.428,3.416,3.404,3.392,3.38,3.367,3.355,3.343,3.331,3.319,3.306,3.298,3.286,3.274,3.262,3.25,3.237,3.229,3.221,3.209,3.197,3.189,3.176,3.164,3.156,3.148,3.136,3.128,3.115,3.107,3.095,3.091,3.079,3.071,3.063,3.05,3.042,3.034,3.026,3.014,3.006,3.002,2.99,2.981,2.973,2.965,2.957,2.949,2.941,2.933,2.925,2.916,2.908,2.9,2.892,2.884,2.88,2.872,2.86,2.855,2.847,2.839,2.831,2.827,2.819,2.811,2.803,2.799,2.79,2.782,2.774,2.77,2.762,2.758,2.75,2.742,2.738,2.73,2.725,2.717,2.709,2.705,2.697,2.689,2.685,2.681,2.673,2.665,2.66,2.656,2.648,2.644,2.64,2.632,2.624,2.62,2.612,2.608,2.604,2.595,2.591,2.587,2.579,2.575,2.571,2.563,2.559,2.555,2.547,2.543,2.539]$floors$::jsonb ->> (least(greatest(pi, 1), 250) - 1))::numeric
-- floors:end
$$;

-- What the player sees after reporting: still waiting, or the result.
create or replace function public.race_view(r public.live_races, me uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'done', r.winner is not null or r.void,
    'void', r.void,
    'won', r.winner = me,
    'forfeit', r.forfeit,
    'my_t', case when me = r.a then r.a_t else r.b_t end,
    'their_t', case when me = r.a then r.b_t else r.a_t end)
$$;

-- Both players call this when the race starts. Creates the race or joins it.
create or replace function public.race_join(race_id text, opponent uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.live_races;
  my_pi int;
begin
  if me is null or opponent is null or me = opponent then
    raise exception 'sign in to race' using errcode = 'insufficient_privilege';
  end if;
  insert into public.live_races (id, a, b) values (race_id, me, opponent) on conflict (id) do nothing;
  select * into r from public.live_races where id = race_id for update;
  if not (me in (r.a, r.b) and opponent in (r.a, r.b)) or r.created_at < now() - interval '10 minutes' then
    raise exception 'not your race' using errcode = 'insufficient_privilege';
  end if;
  select (g.best_car ->> 'pi')::int into my_pi from public.game_saves g where g.owner_id = me;
  if my_pi is null then
    raise exception 'no saved car to race' using errcode = 'no_data_found';
  end if;
  if me = r.a then
    update public.live_races set a_pi = coalesce(a_pi, my_pi) where id = race_id;
  else
    update public.live_races set b_pi = coalesce(b_pi, my_pi) where id = race_id;
  end if;
end $$;

-- Decides the race once both times are in, or once the other player has been silent too long.
create or replace function public.race_decide(race_id text) returns public.live_races
language plpgsql security definer set search_path = '' as $$
declare
  r public.live_races;
begin
  select * into r from public.live_races where id = race_id for update;
  if r.winner is null and not r.void then
    if r.a_t is not null and r.b_t is not null then
      r.winner := case when r.b_t < r.a_t then r.b else r.a end;
    elsif r.a_t is not null and r.a_at < now() - interval '45 seconds' then
      if r.b_pi is null then r.void := true; else r.winner := r.a; r.forfeit := true; end if;
    elsif r.b_t is not null and r.b_at < now() - interval '45 seconds' then
      if r.a_pi is null then r.void := true; else r.winner := r.b; r.forfeit := true; end if;
    end if;
    if r.winner is not null or r.void then
      update public.live_races set winner = r.winner, forfeit = r.forfeit, void = r.void where id = race_id;
    end if;
  end if;
  return r;
end $$;

-- A player's finish time. Reporting again (a retry) keeps the first time.
create or replace function public.race_finish(race_id text, t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.live_races;
  kept numeric;
begin
  select * into r from public.live_races where id = race_id for update;
  if r.id is null or me is null or not me in (r.a, r.b) then
    raise exception 'not your race' using errcode = 'insufficient_privilege';
  end if;
  if t is null or t <= 0 or t > 600 then
    raise exception 'bad time' using errcode = 'check_violation';
  end if;
  if r.winner is null and not r.void then
    if me = r.a and r.a_t is null then
      kept := round(greatest(t, public.race_floor(coalesce(r.a_pi, 0))), 3);
      update public.live_races set a_t = kept, a_at = now() where id = race_id;
    elsif me = r.b and r.b_t is null then
      kept := round(greatest(t, public.race_floor(coalesce(r.b_pi, 0))), 3);
      update public.live_races set b_t = kept, b_at = now() where id = race_id;
    end if;
  end if;
  return public.race_view(public.race_decide(race_id), me);
end $$;

-- Polled while waiting for the other player's time.
create or replace function public.race_status(race_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.live_races;
begin
  select * into r from public.live_races where id = race_id;
  if r.id is null or me is null or not me in (r.a, r.b) then
    raise exception 'not your race' using errcode = 'insufficient_privilege';
  end if;
  return public.race_view(public.race_decide(race_id), me);
end $$;

revoke execute on function public.race_join(text, uuid), public.race_finish(text, numeric), public.race_status(text),
  public.race_decide(text), public.race_view(public.live_races, uuid) from public, anon;
grant execute on function public.race_join(text, uuid), public.race_finish(text, numeric), public.race_status(text) to authenticated;
