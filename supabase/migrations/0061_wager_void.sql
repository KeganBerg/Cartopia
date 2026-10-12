-- Wager refunds for races that never start (2026-10-12). Accepting a wager holds both stakes at once,
-- but the race can still fall through before the start: the challenge had already expired on the
-- challenger's side, or either racer taps Cancel race while waiting. Until now the stakes only came
-- back five minutes later through wager_sync().
--   * wager_start(race_id): each racer's game calls it on GO. From then on the wager can't be called off.
--   * wager_void(race_id): either racer calls off a held wager that hasn't started and has no times in.
--     The race is marked void, so the refund comes from the usual settle trigger (0057/0059).
-- A player who is losing can't use it: by then the race has started (either racer's GO is enough).
-- Adds RPCs the client calls, so run it BEFORE the client ships; the game copes if it's missing.

alter table public.wagers add column if not exists started_at timestamptz;

create or replace function public.wager_start(race_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  update public.wagers x set started_at = coalesce(x.started_at, now())
    where x.race_id = wager_start.race_id and x.status = 'held' and me in (x.a, x.b);
end $$;

create or replace function public.wager_void(race_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.live_races;
  w public.wagers;
begin
  -- Same lock order as race_finish and wager_accept: the race first.
  select * into r from public.live_races x where x.id = wager_void.race_id for update;
  select * into w from public.wagers x where x.race_id = wager_void.race_id for update;
  if me is null or w.race_id is null or not me in (w.a, w.b) or w.status <> 'held' or w.started_at is not null
     or r.a_t is not null or r.b_t is not null or r.winner is not null or r.void then
    return false;
  end if;
  update public.live_races x set void = true where x.id = r.id; -- wager_settle refunds both stakes
  return true;
end $$;

revoke execute on function public.wager_start(text), public.wager_void(text) from public, anon;
grant execute on function public.wager_start(text), public.wager_void(text) to authenticated;
