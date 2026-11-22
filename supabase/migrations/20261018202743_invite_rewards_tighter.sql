-- 0117 Invite rewards, tighter (2026-10-18; Security audit re-check found fresh alts farming invite gems; Kegan
-- said "tighten" in "Cheat-proof economy"). claim_invite_rewards() is 0112's with three changes:
--   the invited player's 100 Gems, and the inviter's 100, are paid once the invited player reaches level 10 (was 5)
--   and their account is at least 3 days old; an inviter earns from at most 20 invited players in all (was 50; still
--   10 a week). Rewards already paid or already owed to an inviter stay as they are.
-- The game claims on every sign-in, so players past level 10 are paid without a client change. Running this file
-- again changes nothing.

create or replace function public.claim_invite_rewards()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  reward constant int := 100;
  week_cap constant int := 10;
  life_cap constant int := 20;
  min_level constant int := 10;
  min_age constant interval := interval '3 days';
  arr public.player_arrivals;
  lvl int;
  born timestamptz;
  st jsonb;
  mine int := 0;
  theirs int := 0;
  due boolean;
  b1 numeric;
  upd bigint;
begin
  if me is null then raise exception 'sign in for invite rewards' using errcode = 'insufficient_privilege'; end if;
  -- Same lock as every other server write to this save (crates, admin, packs).
  perform pg_advisory_xact_lock(hashtext('purchase:' || me::text));
  select g.state, g.level into st, lvl from public.game_saves g where g.owner_id = me for update;
  if st is null then return jsonb_build_object('gems', 0); end if;

  -- As the invitee: level 10 and an account at least 3 days old, so a fresh alt can't be rushed through for gems.
  select * into arr from public.player_arrivals a where a.owner_id = me for update;
  select u.created_at into born from auth.users u where u.id = me;
  if arr.owner_id is not null and arr.inviter is not null and arr.paid_at is null and coalesce(lvl, 1) >= min_level
     and born <= now() - min_age then
    perform pg_advisory_xact_lock(hashtext('invites:' || arr.inviter::text));
    due := (select count(*) from public.player_arrivals a
             where a.inviter = arr.inviter and a.inviter_due and a.paid_at > now() - interval '7 days') < week_cap
       and (select count(*) from public.player_arrivals a
             where a.inviter = arr.inviter and a.inviter_due) < life_cap;
    update public.player_arrivals set paid_at = now(), inviter_due = due where owner_id = me;
    mine := reward;
  end if;

  -- As the inviter.
  with paid as (
    update public.player_arrivals a set inviter_paid_at = now()
     where a.inviter = me and a.inviter_due and a.inviter_paid_at is null
    returning 1)
  select count(*) * reward into theirs from paid;

  if mine + theirs = 0 then
    return jsonb_build_object('gems', 0, 'bucks', public.econ_num(st, 'bucks'));
  end if;
  b1 := least(greatest(public.econ_num(st, 'bucks'), 0) + mine + theirs, 1e12);
  upd := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  update public.game_saves
     set state = st || jsonb_build_object('bucks', b1, 'updatedAt', upd), updated_at = now()
   where owner_id = me;
  return jsonb_build_object('gems', mine + theirs, 'own', mine, 'friends', theirs, 'bucks', b1, 'updatedAt', upd);
end $$;

revoke all on function public.claim_invite_rewards() from public, anon;
grant execute on function public.claim_invite_rewards() to authenticated;
