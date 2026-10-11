-- Private live-race channels (security audit follow-up, 2026-10-11).
-- The game now joins its Realtime channels with `private: true`, so Realtime checks these
-- policies on realtime.messages before letting anyone listen or send:
--   * lobby:v2       the race lobby (presence and challenges): any signed-in player.
--   * race:<id>      one race's positions and finish: only the two players on that race's
--                    live_races row (created by race_join before either joins the channel).
-- Guests (the anon role) get no policy, so they can't join either channel.

drop policy if exists "signed-in players use the race lobby" on realtime.messages;
create policy "signed-in players use the race lobby" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'lobby:v2' and realtime.messages.extension in ('broadcast', 'presence'));

drop policy if exists "signed-in players post in the race lobby" on realtime.messages;
create policy "signed-in players post in the race lobby" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'lobby:v2' and realtime.messages.extension in ('broadcast', 'presence'));

drop policy if exists "racers listen to their race" on realtime.messages;
create policy "racers listen to their race" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'race:%'
    and exists (select 1 from public.live_races r
                where r.id = substr(realtime.topic(), 6) and (select auth.uid()) in (r.a, r.b)
                  and r.created_at > now() - interval '30 minutes'));

drop policy if exists "racers post to their race" on realtime.messages;
create policy "racers post to their race" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'race:%'
    and exists (select 1 from public.live_races r
                where r.id = substr(realtime.topic(), 6) and (select auth.uid()) in (r.a, r.b)
                  and r.created_at > now() - interval '30 minutes'));
