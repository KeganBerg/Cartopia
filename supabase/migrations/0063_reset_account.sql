-- 0063 Reset account (2026-10-12, thread "Reset account", PR #368): Menu > Account > Reset account.
-- Adds an RPC the client calls, so run it BEFORE the client ships; until then the button says reset
-- isn't switched on. Standalone: econ_guard() is untouched.
--
-- One function a signed-in player calls on themselves. It wipes game progress back to a new
-- player's start but keeps the login, the player name (profiles.username), friends and chat.
--   * Leaves their crew first, like leaving (leadership passes on).
--   * Deletes the cloud save row. guard_game_save (0003) and econ_progress only run on UPDATE and
--     no trigger fires on DELETE, so the level-drop guard never sees the reset. The client then
--     INSERTs a fresh starter town, which econ_guard checks like any new player's first save.
--   * Deletes the server records the save keeps cursors into, so a fresh save (crates 0, wagers 0,
--     visits 0, crewChests 0, no bay) can't be paid out again from old rows: crate opens, wager
--     ledger, rescue finds (restore bay), town visitors, crew chests. The bay timer and wager debt
--     live in game_saves.econ and go with the row.
--   * Clears this player's progress boards: weekly stats, time trials, ghost runs, crew and
--     battle points and banks, car meet likes on their cars.
--   * Refuses while a coin wager is held (stake taken, race not settled): settling it later would
--     pay into the new town. Wagers only offered are dropped.
-- economy_flags is an audit log and stays.
--
-- Economy review: the fresh starter town goes in as an INSERT, and econ_guard gives a first save an
-- hour of guest play plus the account's age (up to a day) as allowance. For a reset that allowance
-- would be a whole day's coins and XP on an old account, so the account's age now counts from its
-- last reset (econ_private.account_resets, read by econ_account_age()). Everything a reset clears
-- lived in the old save, so nothing earned before a reset can be carried past it.

create table if not exists econ_private.account_resets (
  owner_id uuid primary key references auth.users on delete cascade,
  at timestamptz not null default now()
);
revoke all on econ_private.account_resets from public, anon, authenticated;

-- Seconds since the account was made, or since its last reset (0002, now reset-aware).
create or replace function econ_private.econ_account_age(uid uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(extract(epoch from now() - (
    select greatest(u.created_at, (select r.at from econ_private.account_resets r where r.owner_id = u.id))
    from auth.users u where u.id = uid and uid = auth.uid())), 0)
$$;

create or replace function public.reset_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  -- One reset at a time per player, and no wager or crate can land halfway through.
  perform pg_advisory_xact_lock(hashtext('wager_ledger:' || me::text));
  if exists (select 1 from public.wagers w where w.status = 'held' and (w.a = me or w.b = me)) then
    raise exception 'Finish your wager race first' using errcode = 'P0001';
  end if;
  delete from public.wagers w where w.status = 'offered' and (w.a = me or w.b = me);

  perform public.leave_clan();

  delete from public.game_saves where owner_id = me;
  delete from public.crate_opens where owner_id = me;
  delete from public.wager_ledger where owner_id = me;
  delete from econ_private.rescue_finds where owner_id = me;
  delete from public.town_visits where owner_id = me;
  delete from public.crew_chests where owner_id = me;
  delete from public.weekly_stats where owner_id = me;
  delete from public.time_trials where owner_id = me;
  delete from public.ghost_runs where owner_id = me;
  delete from public.crew_points where owner_id = me;
  delete from public.crew_bank where owner_id = me;
  delete from public.battle_points where owner_id = me;
  delete from public.battle_bank where owner_id = me;
  delete from public.car_meet_likes where owner = me;
  -- The fresh town's first save gets a new player's allowance, not the account's age.
  insert into econ_private.account_resets (owner_id, at) values (me, now())
    on conflict (owner_id) do update set at = excluded.at;
end $$;

revoke all on function public.reset_my_account() from public, anon;
grant execute on function public.reset_my_account() to authenticated;
