-- Live events (2026-10-12): switch the game for every player at once from the SQL editor.
-- The client (src/lib/liveEventsSync.ts) loads the running events on start and listens on
-- Realtime, so online players switch within seconds; a 60 s poll backs that up.
--   * kind 'night' pins the town clock to midnight (lights on, club open, night music).
--   * kind 'day' pins it to noon (and holds the club shut).
--   * any other kind (e.g. 'techno') starts the feature that registered it in the game
--     (registerLiveKind in src/game/liveEvents.ts) and stops it when the event ends.
-- payload is free-form per kind. Every kind reads payload.message (optional): a toast shown
-- once to each player when the event starts.
-- Only the SQL editor (postgres) writes; players can only read. Standalone: no econ change.
-- Run this BEFORE the game update goes live (the client copes with the table missing).

create table if not exists public.live_events (
  id bigint generated always as identity primary key,
  -- Any short lowercase name; the game ignores kinds it doesn't know yet.
  kind text not null check (kind ~ '^[a-z][a-z0-9_]{0,31}$'),
  payload jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists live_events_ends_at on public.live_events (ends_at);

alter table public.live_events enable row level security;
revoke all on public.live_events from anon, authenticated;
grant select on public.live_events to anon, authenticated;
drop policy if exists "everyone reads live events" on public.live_events;
create policy "everyone reads live events" on public.live_events for select to anon, authenticated using (true);

-- Realtime pushes inserts and changes to every open game.
do $$ begin
  alter publication supabase_realtime add table public.live_events;
exception when duplicate_object then null;
end $$;

-- Start an event now for `minutes`. Ends any running event of the same kind first ('night'
-- and 'day' count as one kind), so 'night' straight after 'day' just switches.
--   select public.live_event_start('night', 60);
--   select public.live_event_start('night', 30, '{"message":"🌙 Midnight Madness! Night for everyone."}');
--   select public.live_event_start('techno', 15);
create or replace function public.live_event_start(p_kind text, p_minutes int, p_payload jsonb default '{}'::jsonb)
returns bigint language plpgsql set search_path = '' as $$
declare v_id bigint;
begin
  update public.live_events set ends_at = now()
    where starts_at <= now() and ends_at > now()
      and (kind = p_kind or (p_kind in ('night', 'day') and kind in ('night', 'day')));
  insert into public.live_events (kind, payload, starts_at, ends_at)
    values (p_kind, coalesce(p_payload, '{}'::jsonb), now(), now() + make_interval(mins => p_minutes))
    returning id into v_id;
  return v_id;
end $$;

-- End every running (and scheduled) event now, or just one kind.
--   select public.live_event_end();
--   select public.live_event_end('night');
create or replace function public.live_event_end(p_kind text default null)
returns int language plpgsql set search_path = '' as $$
declare v_n int;
begin
  update public.live_events set ends_at = now(), starts_at = least(starts_at, now() - interval '1 second')
    where ends_at > now() and (p_kind is null or kind = p_kind);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Players can't call these; the SQL editor runs as postgres and can.
revoke all on function public.live_event_start(text, int, jsonb) from public, anon, authenticated;
revoke all on function public.live_event_end(text) from public, anon, authenticated;
