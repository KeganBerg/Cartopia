-- KBerg lockdown (2026-10-15). Admin powers key on the account id, never on an email or a name,
-- and a stolen password alone stops being enough once Kegan turns on two-step sign-in.
--   * public.admins: the accounts that may use admin RPCs. Seeded with KBerg's id. Add one in
--     the SQL editor: insert into public.admins (owner_id) values ('<auth.users id>');
--   * public.is_admin(): true for an admin's own signed-in session. Once that account has a
--     verified two-step (MFA) factor, the session must also have passed it (JWT aal = 'aal2'),
--     so a leaked password can't reach admin powers. Every admin RPC (rave_start now, the admin
--     panel's next) starts with: if not public.is_admin() then raise ... end if;
--   * rave_start() checked the email address; it now calls is_admin().
--   * set_username() refuses names that look like an admin's or chat mod's username
--     (KBerg, K_Berg, KBerq, KB3rg, TheKBerg1...), unless it's that player.
--   * chat_json() adds 'mod': true on chat mods' messages, so the game can mark the real one.
-- Standalone: no econ_guard/econ_catalog change, writes no ids into saves. Safe to run before the
-- game update (the client ignores 'mod' until it ships).

create table if not exists public.admins (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

insert into public.admins (owner_id)
select u.id from auth.users u where u.id = '8a1e7edb-cb66-437e-b1be-d3768917fda2'
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from public.admins a where a.owner_id = auth.uid())
    and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
         or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.rave_start()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.is_admin() then
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

-- A name reduced to what it looks like: lower case letters only, with look-alike digits and
-- letters folded together (0->o, 1/l->i, 3->e, 4->a, 5->s, 8->b, 9/q->g).
create or replace function public.name_skeleton(p_name text) returns text
language sql immutable set search_path = '' as $$
  select translate(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]', '', 'g'), '0134589ql', 'oieasbggi')
$$;

-- Whether p_name looks like an admin's or a chat mod's username (and p_uid isn't that player).
create or replace function public.name_impersonates(p_name text, p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id is distinct from p_uid and p.username is not null
      and (p.id in (select a.owner_id from public.admins a) or p.id in (select m.owner_id from public.chat_mods m))
      and length(public.name_skeleton(p.username)) >= 3
      and strpos(public.name_skeleton(p_name), public.name_skeleton(p.username)) > 0)
$$;
revoke all on function public.name_impersonates(text, uuid) from public, anon, authenticated;

create or replace function public.set_username(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n text := trim(coalesce(p_name, ''));
  cur public.profiles;
  days int;
begin
  if me is null then return 'no'; end if;
  if not public.username_ok(n) then return 'bad'; end if;
  if public.name_impersonates(n, me) then return 'taken'; end if;
  select * into cur from public.profiles where id = me;
  if found and cur.username is not null then
    if cur.username = n then return 'same'; end if;
    if lower(cur.username) <> lower(n) and cur.username_changed_at > now() - interval '30 days' then
      days := ceil(extract(epoch from (cur.username_changed_at + interval '30 days' - now())) / 86400);
      return 'wait:' || days;
    end if;
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(n) and id <> me) then
    return 'taken';
  end if;
  begin
    insert into public.profiles (id, username, username_changed_at) values (me, n, now())
    on conflict (id) do update set username = excluded.username,
      username_changed_at = case when lower(public.profiles.username) = lower(excluded.username)
                                 then public.profiles.username_changed_at else now() end;
  exception when unique_violation then
    return 'taken';
  end;
  return 'ok';
end $$;
revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

create or replace function public.chat_json(m public.chat_messages) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'room', m.room, 'owner', m.owner_id, 'body', m.body, 'at', m.created_at,
    'name', public.chat_name(m.owner_id),
    'level', coalesce((select g.level from public.game_saves g where g.owner_id = m.owner_id), 1),
    'tag', c.tag, 'emblem', c.emblem, 'color', c.color,
    'mod', exists (select 1 from public.chat_mods cmod where cmod.owner_id = m.owner_id))
  from (select 1) one
  left join public.clan_members cm on cm.owner_id = m.owner_id
  left join public.clans c on c.id = cm.clan_id
$$;
revoke all on function public.chat_json(public.chat_messages) from public, anon, authenticated;
