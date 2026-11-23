-- Drift cleanup found by scripts/check-migration-drift.sql (2026-11-23).
--
-- 1. public.crate_open_retired(text): the pre-0069 crate_open(text), renamed on live outside any
--    migration. Nothing in the game calls it. It is SECURITY DEFINER with the old crate tables and
--    old gem prices (a Gold crate at 8 gems, before gems x10), so if players can still execute it,
--    it opens crates far below today's price. Dropped.
-- 2. public.guard_game_save(): live has the same logic as 20261010222022_save_guard.sql squashed
--    onto one line. Recreated from that file so live and the repo match; behaviour is unchanged.

drop function if exists public.crate_open_retired(text);

create or replace function public.guard_game_save() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce((new.state->>'level')::int, 1) < coalesce((old.state->>'level')::int, 1) then
    raise exception 'refusing to replace a level % save with a level % save',
      old.state->>'level', new.state->>'level' using errcode = 'check_violation';
  end if;
  if new.state is distinct from old.state then
    new.previous_state := old.state;
    new.previous_updated_at := old.updated_at;
  end if;
  return new;
end $$;
