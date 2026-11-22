-- 0080 Gem refunds and chargebacks (2026-10-14; "What to finish, build out or optimize" thread, reviewed by economy).
-- A Stripe refund or chargeback on a gem pack takes the pack back: the webhook (service role) calls
-- purchase_reverse() with the checkout session. Order: run BEFORE the client ships (the webhook calls it).
-- What it does:
--  * Marks the purchases row reversed (once; a Stripe retry is a no-op).
--  * Pack not yet counted by the save (seq > save cursor): purchase_pay stops paying it, nothing else.
--  * Pack counted and bought after the latest reset: takes its gems, coins and parts out of the save.
--    What's already spent can't be taken, so balances stop at 0 and the rest is kept in `short`
--    (gems still owed). checkout.mts refuses new packs for an account with any `short` > 0.
--  * Pack bought before a reset: the reset already wiped it, so the save isn't touched.
-- The save write bumps updated_at, so an open game's next save misses and it reloads the server town.
-- Like any admin write, it restarts that save's server banks and timers (game_saves.econ).
-- Only econ_private.purchase_pay changes besides the new function; econ_guard is untouched.

alter table public.purchases add column if not exists reversed_at timestamptz;
alter table public.purchases add column if not exists reversal text;           -- 'refund' or 'dispute'
alter table public.purchases add column if not exists short int not null default 0 check (short >= 0);

create or replace function public.purchase_reverse(p_session text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.purchases;
  st jsonb;
  cur int;
  reset_at timestamptz;
  b numeric; c numeric; k numeric;
  v_short int := 0;
begin
  select * into p from public.purchases where session_id = p_session;
  if not found then return jsonb_build_object('ok', true, 'missing', true); end if;
  perform pg_advisory_xact_lock(hashtext('purchase:' || p.owner_id::text));
  select * into p from public.purchases where id = p.id for update;
  if p.reversed_at is not null then return jsonb_build_object('ok', true, 'dupe', true); end if;

  select r.at into reset_at from econ_private.account_resets r where r.owner_id = p.owner_id;
  select state into st from public.game_saves where owner_id = p.owner_id for update;
  cur := coalesce(floor(public.econ_num(st, 'purchases')), 0)::int;

  if st is not null and p.seq <= cur and (reset_at is null or p.created_at > reset_at) then
    b := public.econ_num(st, 'bucks'); c := public.econ_num(st, 'coins'); k := public.econ_num(st, 'parts');
    v_short := greatest(p.bucks - greatest(b, 0), 0)::int;
    update public.game_saves
       set state = st || jsonb_build_object('bucks', greatest(b - p.bucks, 0), 'coins', greatest(c - p.coins, 0), 'parts', greatest(k - p.parts, 0)),
           updated_at = now()
     where owner_id = p.owner_id;
  end if;

  update public.purchases set reversed_at = now(), reversal = p_reason, short = v_short where id = p.id;
  return jsonb_build_object('ok', true, 'seq', p.seq, 'counted', p.seq <= cur, 'short', v_short);
end $$;
revoke all on function public.purchase_reverse(text, text) from public, anon, authenticated;
grant execute on function public.purchase_reverse(text, text) to service_role;

-- 0079's purchase_pay, except a reversed pack pays nothing (n still counts it, so the cursor can pass it).
create or replace function econ_private.purchase_pay(p_from int, p_to int)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'n', coalesce((select max(x.seq) from public.purchases x where x.owner_id = auth.uid()), 0),
    'reset', coalesce((select max(x.seq) from public.purchases x
                        join econ_private.account_resets r on r.owner_id = x.owner_id
                        where x.owner_id = auth.uid() and x.created_at <= r.at), 0),
    'bucks', coalesce(sum(p.bucks), 0), 'coins', coalesce(sum(p.coins), 0), 'parts', coalesce(sum(p.parts), 0))
  from public.purchases p
  where p.owner_id = auth.uid() and p.seq > p_from and p.seq <= p_to and p.reversed_at is null
$$;
revoke all on function econ_private.purchase_pay(int, int) from public;
grant execute on function econ_private.purchase_pay(int, int) to authenticated, anon;
