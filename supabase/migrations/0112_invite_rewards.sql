-- 0112 Invite rewards (2026-10-17; Kegan said "go" on in-game growth features in "Launch marketing plan";
-- SQL by "Cheat-proof economy"). New table and RPCs only: no existing function changes, so it can run any
-- time, before or after the client that calls it.
--
-- 1. player_arrivals: one row per account, its first touch (source tag, inviter). No direct access.
-- 2. record_arrival(p_source, p_ref) -> 'ok' | 'exists' | 'no'. Records once per account. p_ref is the
--    inviter's username; it is dropped (the row still records the source) when it is the caller, unknown,
--    an account made after the caller's, or the caller's account is more than 7 days old.
-- 3. claim_invite_rewards() -> jsonb. The caller collects what is theirs, into their own save only:
--      as the invitee: 100 Gems once their level (game_saves.level, which econ_guard checks) reaches 5;
--      as the inviter: 100 Gems for each invitee who reached level 5, at most 10 per rolling 7 days and
--      50 in all. Invitees past the cap still get their own 100 and still count as joined.
--    The inviter is paid when they call it, never by someone else's call, so their open game is never
--    written behind its back. Returns the new gem balance and updatedAt for the game to adopt at once.
-- 4. my_invites() -> jsonb {joined, paid, gems, waiting}.
-- Re-running this file changes nothing that is already there.

create table if not exists public.player_arrivals (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  source text check (source ~ '^[a-z0-9_.-]{1,24}$'),
  inviter uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  inviter_due boolean not null default false,
  inviter_paid_at timestamptz
);
create index if not exists player_arrivals_inviter on public.player_arrivals (inviter) where inviter is not null;
alter table public.player_arrivals enable row level security;
revoke all on table public.player_arrivals from public, anon, authenticated;

create or replace function public.record_arrival(p_source text default null, p_ref text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  src text := lower(btrim(coalesce(p_source, '')));
  ref text := btrim(coalesce(p_ref, ''));
  my_at timestamptz;
  who uuid;
begin
  if me is null then return 'no'; end if;
  if src !~ '^[a-z0-9_.-]{1,24}$' then src := null; end if;
  if ref = '' then ref := null; end if;
  if src is null and ref is null then return 'no'; end if;
  if exists (select 1 from public.player_arrivals a where a.owner_id = me) then return 'exists'; end if;
  select u.created_at into my_at from auth.users u where u.id = me;
  if ref is not null and my_at > now() - interval '7 days' then
    select p.id into who from public.profiles p
      join auth.users u on u.id = p.id
     where lower(p.username) = lower(ref) and p.id <> me and u.created_at < my_at;
  end if;
  insert into public.player_arrivals (owner_id, source, inviter) values (me, src, who)
    on conflict (owner_id) do nothing;
  if not found then return 'exists'; end if;
  return 'ok';
end $$;
revoke all on function public.record_arrival(text, text) from public, anon;
grant execute on function public.record_arrival(text, text) to authenticated;

create or replace function public.claim_invite_rewards()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  reward constant int := 100;
  week_cap constant int := 10;
  life_cap constant int := 50;
  arr public.player_arrivals;
  lvl int;
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

  -- As the invitee.
  select * into arr from public.player_arrivals a where a.owner_id = me for update;
  if arr.owner_id is not null and arr.inviter is not null and arr.paid_at is null and coalesce(lvl, 1) >= 5 then
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

create or replace function public.my_invites()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'joined', count(*),
    'paid', count(*) filter (where a.paid_at is not null),
    'gems', 100 * count(*) filter (where a.inviter_paid_at is not null),
    'waiting', 100 * count(*) filter (where a.inviter_due and a.inviter_paid_at is null))
  from public.player_arrivals a where a.inviter = auth.uid() and auth.uid() is not null
$$;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;
