-- Security audit follow-ups (2026-10-12). Standalone: no econ_guard/econ_catalog change, writes
-- no new ids into saves, so it can run any time. Needs a migration number from the economy thread.
--
-- Deleting an account in the middle of a held wager stranded the other racer's stake: the wagers
-- row went with the account (on delete cascade) but their 'hold' ledger row stayed, so they were
-- never paid or refunded. delete_my_account() now settles every held wager first, as a forfeit:
-- the player who stays is paid both stakes, like a race the other side quit.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  w record;
begin
  if me is null then raise exception 'Not signed in'; end if;
  for w in select x.race_id, x.a, x.b from public.wagers x where x.status = 'held' and me in (x.a, x.b) loop
    perform econ_private.wager_pay(w.race_id, case when w.a = me then w.b else w.a end);
  end loop;
  perform public.leave_clan();
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
