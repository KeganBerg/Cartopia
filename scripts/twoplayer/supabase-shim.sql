-- The parts of a Supabase database our migrations lean on, for a throwaway local Postgres:
-- the API roles, auth.users/auth.uid(), realtime.messages/topic()/send(). Test only.
-- Roles are cluster-wide, so a second database on the same cluster finds them already there.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login password 'authenticator' noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;

create schema auth;
create schema realtime;
create schema extensions;
grant usage on schema public, auth, realtime, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}',
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, status text not null default 'unverified');

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon')
$$;
create function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email'
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null,
  event text,
  payload jsonb,
  private boolean default true,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to anon, authenticated;
grant usage on sequence realtime.messages_id_seq to anon, authenticated;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')
$$;
grant execute on function realtime.topic() to anon, authenticated, service_role;
-- Server-side broadcasts: the local gateway LISTENs on this and fans them out.
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
language plpgsql security definer as $$
begin
  perform pg_notify('realtime_send', jsonb_build_object('topic', topic, 'event', event, 'payload', payload, 'private', private)::text);
end;
$$;
grant execute on function realtime.send(jsonb, text, text, boolean) to anon, authenticated, service_role;
create publication supabase_realtime;
