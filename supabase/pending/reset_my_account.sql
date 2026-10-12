-- Reset account (Menu > Account > Reset account). Unnumbered: the economy thread numbers it.
-- Run BEFORE the client that calls it ships; until then the button says reset isn't switched on.
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
end $$;

revoke all on function public.reset_my_account() from public, anon;
grant execute on function public.reset_my_account() to authenticated;
