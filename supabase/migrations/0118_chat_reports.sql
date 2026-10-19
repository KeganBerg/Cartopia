-- 0118 Chat reports (2026-10-18; Kegan: chat needs a Report button that reaches the admin panel and
-- support@cartopia.lol. "Launch readiness check" thread; numbered and reviewed by "Cheat-proof economy").
-- A player flags a chat message; admins see it in the admin panel (🚩 Reports)
-- and netlify/functions/chat-report.mts emails support@cartopia.lol.
--   * chat_report(id, reason): any signed-in player who can read that room. One report per
--     player per message, 10 a day. Keeps a copy of the message so deleting it keeps the report.
--   * admin_reports(): open reports, newest first, one row per message with how many reported it.
--   * admin_report_close(message, outcome): closes every open report on that message.
-- Standalone: no econ_catalog/econ_guard change. Run before the game update ships. Running it again changes nothing.

create table if not exists public.chat_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  reporter uuid not null references auth.users (id) on delete cascade,
  reported uuid references auth.users (id) on delete set null,
  message_id bigint not null,
  room text not null,
  body text not null,
  reason text not null check (reason in ('mean', 'spam', 'unsafe')),
  closed_at timestamptz,
  closed_by uuid,
  outcome text check (outcome in ('dismissed', 'deleted', 'muted')),
  unique (reporter, message_id)
);
create index if not exists chat_reports_open on public.chat_reports (created_at desc) where closed_at is null;
alter table public.chat_reports enable row level security;
revoke all on table public.chat_reports from anon, authenticated;

create or replace function public.chat_report(p_id bigint, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.chat_messages;
  rid bigint;
begin
  if uid is null then raise exception 'sign in'; end if;
  if p_reason not in ('mean', 'spam', 'unsafe') then raise exception 'bad reason'; end if;
  select * into m from public.chat_messages c where c.id = p_id;
  if not found then raise exception 'gone'; end if;
  if not public.chat_room_ok(m.room) then raise exception 'not in that room'; end if;
  if m.owner_id = uid then raise exception 'yours'; end if;
  -- One report at a time per player, so reports sent together can't slip past the daily limit.
  perform pg_advisory_xact_lock(hashtext('chat_report:' || uid::text));
  if (select count(*) from public.chat_reports r where r.reporter = uid and r.created_at > now() - interval '1 day') >= 10 then
    raise exception 'slow down';
  end if;
  insert into public.chat_reports (reporter, reported, message_id, room, body, reason)
  values (uid, m.owner_id, m.id, m.room, m.body, p_reason)
  on conflict (reporter, message_id) do nothing
  returning id into rid;
  return jsonb_build_object(
    'new', rid is not null,
    'reason', p_reason,
    'room', case when m.room = 'global' then 'global' else 'crew' end,
    'body', m.body,
    'reported', public.chat_name(m.owner_id),
    'reporter', public.chat_name(uid),
    'reports', (select count(*) from public.chat_reports r where r.message_id = m.id and r.closed_at is null),
    'open', (select count(distinct r.message_id) from public.chat_reports r where r.closed_at is null));
end $$;
revoke all on function public.chat_report(bigint, text) from public, anon;
grant execute on function public.chat_report(bigint, text) to authenticated;

create or replace function public.admin_reports() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_gate();
  return coalesce((
    select jsonb_agg(x order by x->>'at' desc) from (
      select jsonb_build_object(
        'message', r.message_id,
        'at', max(r.created_at),
        'room', min(r.room),
        'body', min(r.body),
        'reported', min(r.reported::text),
        'reportedName', public.chat_name(min(r.reported::text)::uuid),
        'reasons', jsonb_agg(distinct r.reason),
        'count', count(*),
        'reporter', public.chat_name((array_agg(r.reporter order by r.created_at))[1]),
        'live', exists (select 1 from public.chat_messages c where c.id = r.message_id)) x
      from public.chat_reports r
      where r.closed_at is null
      group by r.message_id
      order by max(r.created_at) desc
      limit 50) t), '[]'::jsonb);
end $$;
revoke all on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

create or replace function public.admin_report_close(p_message bigint, p_outcome text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.admin_gate();
  n integer;
  who uuid;
begin
  if p_outcome not in ('dismissed', 'deleted', 'muted') then raise exception 'bad outcome'; end if;
  select r.reported into who from public.chat_reports r where r.message_id = p_message limit 1;
  update public.chat_reports r set closed_at = now(), closed_by = me, outcome = p_outcome
  where r.message_id = p_message and r.closed_at is null;
  get diagnostics n = row_count;
  if n > 0 then
    perform public.admin_note(me, 'report_close', who, jsonb_build_object('message', p_message, 'outcome', p_outcome, 'reports', n));
  end if;
  return n;
end $$;
revoke all on function public.admin_report_close(bigint, text) from public, anon;
grant execute on function public.admin_report_close(bigint, text) to authenticated;
