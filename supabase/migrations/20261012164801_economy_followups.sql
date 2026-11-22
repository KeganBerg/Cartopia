-- 0059 economy integrity follow-ups (2026-10-12). Standalone: no econ_guard/econ_catalog change and
-- no new ids in saves, so it can run any time.
--
-- 1. Wager caps: two players can bet on at most 3 races with each other per UTC day, a player on at
--    most 10, and a player who is already 500,000 coins up on wagers today can't bet again until
--    tomorrow. Two accounts can't keep throwing races to move coins between them, and a modded
--    client that always reports a perfect time can only take so much. wager_accept is otherwise 0057.
-- 2. Wager payouts check the winner's time against the server clock: a finish reported sooner after
--    the stakes were held than the time it claims is impossible, so the stakes are refunded instead.
--    A win within 2% of the fastest possible time for that car is paid but written to economy_flags
--    ('wager_fast') for review.
-- 3. Deleting an account mid-wager (Security audit, finding 1): the held wager is paid to the other
--    racer as a forfeit first, so their stake isn't stranded when the wagers row cascades away.

create or replace function public.wager_accept(race_id text, stake int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  w public.wagers;
  r public.live_races;
begin
  -- The race row first (race_finish locks it too), so nobody finishes while the stakes go down.
  select * into r from public.live_races x where x.id = wager_accept.race_id for update;
  select * into w from public.wagers x where x.race_id = wager_accept.race_id for update;
  if me is null or w.race_id is null or w.b <> me or w.status <> 'offered' or w.created_at < now() - interval '90 seconds'
     or w.stake is distinct from wager_accept.stake
     or r.a_t is not null or r.b_t is not null or r.winner is not null or r.void then
    raise exception 'wager expired' using errcode = 'insufficient_privilege';
  end if;
  -- Daily caps (UTC day), so two accounts can't keep throwing races to move coins: the same two
  -- players bet at most 3 races a day, and a player at most 10.
  if (select count(*) from public.wagers x
      where x.status in ('held', 'settled') and x.held_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
        and ((x.a = w.a and x.b = w.b) or (x.a = w.b and x.b = w.a))) >= 3 then
    raise exception 'wager limit for today' using errcode = 'check_violation';
  end if;
  if (select greatest(count(*) filter (where w.a in (x.a, x.b)), count(*) filter (where w.b in (x.a, x.b)))
      from public.wagers x
      where x.status in ('held', 'settled') and x.held_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
        and (w.a in (x.a, x.b) or w.b in (x.a, x.b))) >= 10 then
    raise exception 'wager limit for today' using errcode = 'check_violation';
  end if;
  if (select coalesce(max(n), 0) from (select sum(l.delta) n from public.wager_ledger l
      where l.owner_id in (w.a, w.b) and l.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
      group by l.owner_id) d) >= 500000 then
    raise exception 'wager limit for today' using errcode = 'check_violation';
  end if;
  if coalesce(econ_private.wager_coins(w.b), 0) < w.stake then
    raise exception 'not enough coins' using errcode = 'check_violation';
  end if;
  if coalesce(econ_private.wager_coins(w.a), 0) < w.stake then
    raise exception 'challenger short of coins' using errcode = 'check_violation';
  end if;
  perform econ_private.wager_post(w.a, w.race_id, -w.stake, 'hold');
  perform econ_private.wager_post(w.b, w.race_id, -w.stake, 'hold');
  update public.wagers x set status = 'held', held_at = now() where x.race_id = w.race_id;
end $$;

-- Pays out once the referee decides the race (0057), unless the winner's time can't be real.
create or replace function econ_private.wager_settle() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  w public.wagers;
  t numeric;
  fin timestamptz;
  floor_t numeric;
begin
  if (new.winner is not null or new.void) and old.winner is null and not old.void then
    if new.winner is not null then
      select * into w from public.wagers x where x.race_id = new.id and x.status = 'held';
      if w.race_id is not null then
        t := case when new.winner = new.a then new.a_t else new.b_t end;
        fin := case when new.winner = new.a then new.a_at else new.b_at end;
        floor_t := public.race_floor(coalesce(case when new.winner = new.a then new.a_pi else new.b_pi end, 0));
        if t is null or fin is null or extract(epoch from fin - w.held_at) < t - 0.25 then
          insert into public.economy_flags (owner_id, corrections) values (new.winner, jsonb_build_object('wager_fast',
            jsonb_build_object('race', new.id, 't', t, 'elapsed', round(extract(epoch from fin - w.held_at)::numeric, 3), 'stake', w.stake, 'refunded', true)));
          perform econ_private.wager_pay(new.id, null);
          return null;
        end if;
        if t <= floor_t * 1.02 then
          insert into public.economy_flags (owner_id, corrections) values (new.winner, jsonb_build_object('wager_fast',
            jsonb_build_object('race', new.id, 't', t, 'floor', floor_t, 'stake', w.stake)));
        end if;
      end if;
    end if;
    perform econ_private.wager_pay(new.id, new.winner);
  end if;
  return null;
end $$;
revoke execute on function econ_private.wager_settle() from public, anon, authenticated;

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
