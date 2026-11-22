-- Live events on a private Realtime channel (2026-10-13). Realtime "Allow public access to
-- channels" is now off, so the public 'live-events' channel the game listened on for live_events
-- changes is refused, and a started event only shows at the next 60-second poll. The game now
-- opens 'live-events' as a private channel; this lets everyone, guests included, listen there.
-- Listen only: nobody may post on it. The rows themselves are still read under live_events RLS
-- ("everyone reads live events"). Standalone; safe to run before or after the game update
-- (until both are in, the game falls back to its poll).

drop policy if exists "everyone listens for live events" on realtime.messages;
create policy "everyone listens for live events" on realtime.messages
  for select to anon, authenticated
  using (realtime.topic() = 'live-events');
