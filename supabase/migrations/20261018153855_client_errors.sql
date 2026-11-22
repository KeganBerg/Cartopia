-- 0116 Client crash reports (2026-10-18; "Launch readiness check" thread, PR #689). New table only: a Netlify
-- function inserts with the service role; players have no access (RLS on, no policies, no grants). Rows are cut
-- to a fixed size on insert, and rows older than 30 days are dropped after each insert.
-- Running this file again changes nothing.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text, message text not null, stack text, build text, url text, ua text
);
alter table public.client_errors enable row level security;
revoke all on table public.client_errors from public, anon, authenticated;
create index if not exists client_errors_created on public.client_errors (created_at desc);

-- Each field cut to a fixed length, so a flood of huge reports can't fill the database.
create or replace function public.client_errors_clip() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.kind := left(new.kind, 40);
  new.message := left(coalesce(new.message, ''), 2000);
  new.stack := left(new.stack, 8000);
  new.build := left(new.build, 80);
  new.url := left(new.url, 500);
  new.ua := left(new.ua, 400);
  return new;
end $$;

-- Keeps 30 days. An index range scan per insert statement; skipped while another insert is already trimming.
create or replace function public.client_errors_trim() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_try_advisory_xact_lock(hashtext('client_errors_trim')) then
    delete from public.client_errors where created_at < now() - interval '30 days';
  end if;
  return null;
end $$;

create or replace trigger client_errors_clip before insert on public.client_errors
  for each row execute function public.client_errors_clip();
create or replace trigger client_errors_trim after insert on public.client_errors
  for each statement execute function public.client_errors_trim();

revoke execute on function public.client_errors_clip(), public.client_errors_trim() from public, anon, authenticated;
