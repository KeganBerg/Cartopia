-- Keep the previous cloud save on every overwrite, and refuse saves that would drop a player's level.
alter table public.game_saves add column if not exists previous_state jsonb;
alter table public.game_saves add column if not exists previous_updated_at timestamptz;

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

drop trigger if exists guard_game_save on public.game_saves;
create trigger guard_game_save before update on public.game_saves
  for each row execute function public.guard_game_save();
