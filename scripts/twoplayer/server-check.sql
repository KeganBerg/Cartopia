-- Live race, wager and crew race server checks, run as real signed-in players against a fresh local
-- database with every migration (scripts/twoplayer/server-check.sh). Stops at the first failure.
\set ON_ERROR_STOP 1
\set QUIET 1
\set VERBOSITY terse
-- Only the checks print (as notices); query results go nowhere.
\o /dev/null

\set A '\'d1d1d1d1-0000-4000-8000-000000000001\''
\set B '\'d2d2d2d2-0000-4000-8000-000000000002\''
\set C '\'d3d3d3d3-0000-4000-8000-000000000003\''
\set as_a 'reset role; set request.jwt.claims = \'{"sub":"d1d1d1d1-0000-4000-8000-000000000001","role":"authenticated"}\'; set role authenticated;'
\set as_b 'reset role; set request.jwt.claims = \'{"sub":"d2d2d2d2-0000-4000-8000-000000000002","role":"authenticated"}\'; set role authenticated;'
\set as_c 'reset role; set request.jwt.claims = \'{"sub":"d3d3d3d3-0000-4000-8000-000000000003","role":"authenticated"}\'; set role authenticated;'
\set as_admin 'reset role; reset request.jwt.claims;'

create or replace function pg_temp.ok(c boolean, name text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FAIL %', name; end if;
  raise notice 'ok   %', name;
end $$;
create or replace function pg_temp.ledger(who uuid, race text) returns text language sql as $$
  select coalesce(string_agg(kind || ' ' || delta, ', ' order by seq), '') from public.wager_ledger where owner_id = who and race_id = race
$$;
create or replace function pg_temp.coins(who uuid) returns numeric language sql as $$ select econ_private.wager_coins(who) $$;

-- Three level 20 players with 50,000 coins and the same car.
insert into auth.users (id, email, encrypted_password) values (:A, 'sql-a@test.local', 'x'), (:B, 'sql-b@test.local', 'x'), (:C, 'sql-c@test.local', 'x');
insert into public.game_saves (owner_id, state)
select u, jsonb_build_object('level', 20, 'coins', 50000, 'townName', t, 'raceCar', 'c1', 'updatedAt', 1,
  'cars', jsonb_build_array(jsonb_build_object('uid', 'c1', 'model', 'gtr', 'color', '#e53935', 'upgrades', jsonb_build_object('engine', 3, 'turbo', 3, 'tires', 3, 'weight', 3))))
from (values (:A::uuid, 'Sql A'), (:B::uuid, 'Sql B'), (:C::uuid, 'Sql C')) v(u, t);
select pg_temp.ok((select count(*) = 3 from public.game_saves where owner_id in (:A, :B, :C) and (best_car ->> 'pi')::int > 0), 'saves have a race car');

-- 1. A plain live race: both join, both finish, the faster one wins. --------------------------------
:as_a
select public.race_join('11111111-race-0001', :B);
:as_b
select public.race_join('11111111-race-0001', :A);
:as_c
do $$ begin
  perform public.race_finish('11111111-race-0001', 9);
  raise exception 'FAIL an outsider reported a time';
exception when insufficient_privilege then null;
end $$;
-- The race channel is private to its two racers (0020_private_realtime.sql).
:as_admin
insert into realtime.messages (topic, extension, event, payload) values ('race:11111111-race-0001', 'broadcast', 'probe', '{}');
:as_c
select set_config('realtime.topic', 'race:11111111-race-0001', false) \g /dev/null
select count(*) as c_sees from realtime.messages where event = 'probe' \gset
:as_a
select set_config('realtime.topic', 'race:11111111-race-0001', false) \g /dev/null
select count(*) as a_sees from realtime.messages where event = 'probe' \gset
:as_admin
select pg_temp.ok(:c_sees = 0 and :a_sees = 1, 'race channel readable by its racers only');
:as_a
select public.race_finish('11111111-race-0001', 12.5) ->> 'done' as a_done \gset
:as_b
select (public.race_finish('11111111-race-0001', 13.25)) ->> 'won' as b_won \gset
:as_admin
select pg_temp.ok(:'a_done' = 'false' and :'b_won' = 'false', 'verdict waits for both times, then the slower player lost');
select pg_temp.ok((select winner = :A and not forfeit and not void from public.live_races where id = '11111111-race-0001'), 'faster player is the winner');
:as_a
select pg_temp.ok((public.race_status('11111111-race-0001') ->> 'won')::boolean, 'winner sees the win');

-- 2. An impossible time is raised to the car's floor. -------------------------------------------
:as_a
select public.race_join('11111111-race-0002', :B);
:as_b
select public.race_join('11111111-race-0002', :A);
select public.race_finish('11111111-race-0002', 0.5);
:as_admin
select pg_temp.ok((select b_t = public.race_floor(b_pi) from public.live_races where id = '11111111-race-0002'), 'too-fast time raised to the floor');

-- 3. A wager race: both stakes held at accept, the winner takes both. ---------------------------
:as_a
select public.race_join('22222222-bet-0001', :B);
do $$ begin
  perform public.wager_offer('22222222-bet-0001', 777);
  raise exception 'FAIL an odd stake was accepted';
exception when check_violation then null;
end $$;
select public.wager_offer('22222222-bet-0001', 2000);
:as_b
select public.race_join('22222222-bet-0001', :A);
do $$ begin
  perform public.wager_accept('22222222-bet-0001', 10000);
  raise exception 'FAIL accepted a different stake than offered';
exception when insufficient_privilege then null;
end $$;
select public.wager_accept('22222222-bet-0001', 2000);
:as_admin
select pg_temp.ok(pg_temp.ledger(:A, '22222222-bet-0001') = 'hold -2000' and pg_temp.ledger(:B, '22222222-bet-0001') = 'hold -2000', 'accept holds both stakes');
select pg_temp.ok(pg_temp.coins(:A) = 48000 and pg_temp.coins(:B) = 48000, 'held stakes come off both players');
:as_a
select public.wager_start('22222222-bet-0001');
select pg_temp.ok(not public.wager_void('22222222-bet-0001'), 'a started bet cannot be called off');
-- The race takes real time: a winning time shorter than the wait since the stakes went down is refunded (0059).
:as_admin
update public.wagers set held_at = now() - interval '30 seconds' where race_id = '22222222-bet-0001';
:as_a
select public.race_finish('22222222-bet-0001', 14.0);
:as_b
select public.race_finish('22222222-bet-0001', 13.0);
:as_admin
select pg_temp.ok((select status = 'settled' from public.wagers where race_id = '22222222-bet-0001'), 'bet settled when the race is decided');
select pg_temp.ok(pg_temp.ledger(:B, '22222222-bet-0001') = 'hold -2000, win 4000' and pg_temp.ledger(:A, '22222222-bet-0001') = 'hold -2000', 'winner is paid both stakes');
select pg_temp.ok(pg_temp.coins(:A) = 48000 and pg_temp.coins(:B) = 52000, 'loser 2,000 down, winner 2,000 up');

-- 4. The game claims the ledger rows in its next save: coins and the claim count line up. --------
:as_b
update public.game_saves set state = state || jsonb_build_object('wagers', 2, 'coins', 52000, 'updatedAt', 2) where owner_id = :B;
:as_a
update public.game_saves set state = state || jsonb_build_object('wagers', 1, 'coins', 48000, 'updatedAt', 2) where owner_id = :A;
:as_admin
select pg_temp.ok((select (state ->> 'coins')::numeric = 52000 and (state ->> 'wagers')::int = 2 and coalesce((econ ->> 'wager_debt')::numeric, 0) = 0 from public.game_saves where owner_id = :B), 'winner''s save keeps the winnings');
select pg_temp.ok((select (state ->> 'coins')::numeric = 48000 and (state ->> 'wagers')::int = 1 from public.game_saves where owner_id = :A), 'loser''s save keeps the loss');
select pg_temp.ok(pg_temp.coins(:A) = 48000 and pg_temp.coins(:B) = 52000, 'server coins unchanged by the claim');
-- Claiming the same rows twice adds nothing.
:as_b
update public.game_saves set state = state || jsonb_build_object('wagers', 2, 'coins', 52000, 'updatedAt', 3) where owner_id = :B;
:as_admin
select pg_temp.ok(pg_temp.coins(:B) = 52000, 'a second claim of the same rows adds nothing');

-- 5. A bet called off before GO gives both stakes back. -----------------------------------------
:as_b
select public.race_join('22222222-bet-0002', :A);
select public.wager_offer('22222222-bet-0002', 500);
:as_a
select public.race_join('22222222-bet-0002', :B);
select public.wager_accept('22222222-bet-0002', 500);
:as_c
select pg_temp.ok(not public.wager_void('22222222-bet-0002'), 'an outsider cannot call the bet off');
:as_a
select pg_temp.ok(public.wager_void('22222222-bet-0002'), 'a racer calls the bet off before GO');
:as_admin
select pg_temp.ok(pg_temp.ledger(:A, '22222222-bet-0002') = 'hold -500, refund 500' and pg_temp.ledger(:B, '22222222-bet-0002') = 'hold -500, refund 500', 'both stakes refunded');
select pg_temp.ok((select void from public.live_races where id = '22222222-bet-0002'), 'race marked void');
select pg_temp.ok(pg_temp.coins(:A) = 48000 and pg_temp.coins(:B) = 52000, 'nobody gains or loses from a called-off bet');
:as_b
do $$ begin
  perform public.race_finish('22222222-bet-0002', 12);
end $$;
:as_admin
select pg_temp.ok((select winner is null from public.live_races where id = '22222222-bet-0002'), 'a void race takes no times');

-- 6. A racer who never finishes: the other wins by forfeit after 45 s and takes the pot. ---------
:as_a
select public.race_join('22222222-bet-0003', :B);
select public.wager_offer('22222222-bet-0003', 500);
:as_b
select public.race_join('22222222-bet-0003', :A);
select public.wager_accept('22222222-bet-0003', 500);
select public.wager_start('22222222-bet-0003');
:as_admin
update public.wagers set held_at = now() - interval '90 seconds' where race_id = '22222222-bet-0003';
:as_b
select public.race_finish('22222222-bet-0003', 13);
:as_admin
update public.live_races set b_at = now() - interval '50 seconds' where id = '22222222-bet-0003';
:as_b
select pg_temp.ok((public.race_status('22222222-bet-0003') ->> 'won')::boolean, 'finisher wins when the rival never finishes');
:as_admin
select pg_temp.ok((select forfeit from public.live_races where id = '22222222-bet-0003'), 'called as a forfeit');
select pg_temp.ok(pg_temp.ledger(:B, '22222222-bet-0003') = 'hold -500, win 1000', 'forfeit pays the pot to the finisher');

-- 7. The same two players bet at most 3 races a day (0059): a 4th is refused at accept.
:as_a
select public.race_join('22222222-bet-0005', :B);
select public.wager_offer('22222222-bet-0005', 500);
:as_b
select public.race_join('22222222-bet-0005', :A);
do $$ begin
  perform public.wager_accept('22222222-bet-0005', 500);
  raise exception 'FAIL a 4th bet between the same two players was held';
exception when check_violation then
  if sqlerrm <> 'wager limit for today' then raise; end if;
  raise notice 'ok   a 4th bet between the same two players today is refused';
end $$;

-- 8. A win reported sooner than the race could have been driven is refunded, not paid. -----------
:as_c
select public.race_join('22222222-bet-0004', :B);
select public.wager_offer('22222222-bet-0004', 500);
:as_b
select public.race_join('22222222-bet-0004', :C);
select public.wager_accept('22222222-bet-0004', 500);
select public.race_finish('22222222-bet-0004', 13);
:as_c
select public.race_finish('22222222-bet-0004', 14);
:as_admin
select pg_temp.ok(pg_temp.ledger(:B, '22222222-bet-0004') = 'hold -500, refund 500' and pg_temp.ledger(:C, '22222222-bet-0004') = 'hold -500, refund 500', 'an impossible-fast win is refunded');
select pg_temp.ok((select count(*) = 1 from public.economy_flags where owner_id = :B and corrections ? 'wager_fast'), 'and flagged for review');

-- 9. Crew races: a live race between crewmates scores for their crew battle. ---------------------
:as_a
select public.create_clan('Sql Crew', 'SQL', '🏁', '#1e88e5', 'server check', 1) as crew \gset
:as_b
select public.join_clan(:'crew');
:as_admin
select pg_temp.ok((select count(*) = 2 from public.clan_members where clan_id = :'crew'), 'both racers in one crew');
:as_a
select public.race_join('33333333-crew-0001', :B);
:as_b
select public.race_join('33333333-crew-0001', :A);
select public.race_finish('33333333-crew-0001', 13);
:as_a
select public.race_finish('33333333-crew-0001', 12);
:as_admin
select pg_temp.ok((select winner = :A from public.live_races where id = '33333333-crew-0001'), 'crew race decided');
select pg_temp.ok((select live = 1 and points = 10 from public.battle_points where owner_id = :A and clan_id = :'crew'), 'live win scores 10 crew battle points');

-- 10. The first endless goals board on a town saved without one (the end of the tutorial) saves
-- cleanly as the game sends it (dated, nothing collected). A correction would reload the page.
:as_admin
update public.game_saves set state = state - 'endless', corrections = null where owner_id = :C;
:as_c
update public.game_saves set corrections = null, state = state || jsonb_build_object('updatedAt', 9, 'endless',
  jsonb_build_object('n', 0, 'today', 0, 'day', to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'goals', '[{"k":1,"n":1,"base":0,"kind":"drivers"}]'::jsonb))
  where owner_id = :C;
:as_admin
select pg_temp.ok((select not coalesce(corrections ? 'endless', false) from public.game_saves where owner_id = :C), 'first endless board saves without an endless correction');

do $$ begin raise notice 'ok   all server checks passed'; end $$;
