-- Kart party floor by PI (2026-10-12). 0058 let every kart finish in 25 seconds, whatever its PI, so a
-- modded game in a slow car could report 25 s and place first. Now the fastest finish depends on the
-- player's PI (the server's, from kart_party_join), like race_floor() for drag races:
--   three laps of the shortest racing line on any circuit (Main St, 350 m hugging every inside kerb;
--   1040 m for three laps leaves a little slack) at 1.6x the kart's top speed from kartStats() in
--   src/game/kart.ts, flat out the whole way.
-- The fastest real boost (rocket, or a boost with the ghost) is 1.45x, so no honest finish is faster.
-- PI 1: 43.0 s, PI 100: 30.9 s, any PI: 27.1 s or more.
-- src/game/kartFloor.test.ts checks these numbers against the game. Standalone: replaces only
-- kart_floor() and kart_party_finish() from 0058; no econ_guard/econ_catalog change, no new ids in saves.

-- kart:begin
create or replace function public.kart_floor(pi int) returns numeric
language sql immutable set search_path = '' as $$
  select round(1040 / ((15 + 9 * (1 - exp(-greatest(coalesce(pi, 1), 1) / 90.0))) * 1.6), 3)
$$;
-- kart:end

create or replace function public.kart_party_finish(party_id text, t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p public.kart_parties;
  i int;
begin
  select * into p from public.kart_parties where id = party_id for update;
  i := array_position(p.players, me);
  if p.id is null or me is null or i is null or p.pis[i] is null then
    raise exception 'not your party' using errcode = 'insufficient_privilege';
  end if;
  if t is null or t <= 0 or t > 900 then
    raise exception 'bad time' using errcode = 'check_violation';
  end if;
  if not p.done and p.times[i] is null then
    p.times[i] := round(greatest(t, public.kart_floor(p.pis[i])), 3);
    update public.kart_parties set times = p.times, first_at = coalesce(first_at, now()) where id = party_id;
  end if;
  return public.kart_party_view(public.kart_party_decide(party_id), me);
end $$;

drop function if exists public.kart_floor();
-- Supabase grants every new function to anon and authenticated; the floor stays server-only.
revoke execute on function public.kart_floor(int) from public, anon, authenticated;
