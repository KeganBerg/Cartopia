-- 0056: delete account (Menu > Account > Delete account).
-- One function a signed-in player calls on themselves. It leaves their crew
-- first (so leadership passes to the longest-serving member, like leaving),
-- then deletes their auth.users row. Every table that points at auth.users is
-- ON DELETE CASCADE (checked live 2026-10-12), so the save, profile, friends,
-- chat, alerts, races and crew points go with it. The save guard only runs on
-- UPDATE, and no trigger fires on DELETE in public or econ_private (checked
-- live 2026-10-12). leave_clan() returns quietly for a player with no crew.
-- Safe to run before the client ships: the button errors politely until then.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  perform public.leave_clan();
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
