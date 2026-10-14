-- Rave button (2026-10-14): Kegan's Neon Owl button starts Rave Mode in every town.
-- Only the account with email keganbergeron@gmail.com may call it; everyone else gets an error,
-- whatever the game shows. It adds a 'rave' live event starting now: every game plays a
-- ten-second warning while halcyon's build-up fades in, drops ten seconds after the press,
-- and loops the drop twice (the event ends 68.2 s after the press, right as the second pass
-- ends). Pressing it while a rave is already on does nothing.
-- Standalone: needs 0055_live_events.sql (already run). No econ change. Safe to run before
-- or after the game update (until it runs, the button says Rave Mode could not start).

create or replace function public.rave_start()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_email text; v_id bigint;
begin
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is distinct from 'keganbergeron@gmail.com' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select e.id into v_id from public.live_events e
    where e.kind in ('rave', 'techno') and e.starts_at <= now() and e.ends_at > now()
    order by e.starts_at desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.live_events (kind, payload, starts_at, ends_at)
    values ('rave', '{"by":"button"}'::jsonb, now(), now() + interval '68.2 seconds')
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.rave_start() from public, anon;
grant execute on function public.rave_start() to authenticated;
