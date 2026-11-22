-- 0120 Roblox link hardening (2026-10-19; review of 0119, spec from the Roblox port handoff thread). Needs 0119.
--  1. A server key only the Roblox game knows. Its sha256 is kept in econ_private.roblox_server_key (no grants);
--     roblox_new_secret() makes a new one and shows it once. The last line of this file calls it, so the key
--     appears in the SQL editor's result: it goes into Roblox Creator Dashboard > Secrets as CARTOPIA_LINK_KEY.
--     Running roblox_new_secret() again (or this file) replaces the key, and Roblox needs the new one.
--  2. roblox_claim(): 0119's, but first checks the x-cartopia-key request header against that hash and answers
--     { error: 'server' } on a mismatch or when no key is set. Same signature and grants (anon).
--  3. roblox_unlink() (signed in): removes the player's Roblox link and their unused codes.
--  4. roblox_link_status() (signed in): { linked, roblox_user_id, linked_at }.
--  5. roblox_link_code(): codes from 8 random bytes (40 bits), the player's older unused codes are deleted, and
--     used or expired codes more than a day old are cleaned up.

create table if not exists econ_private.roblox_server_key (
  id int primary key default 1 check (id = 1),
  key_hash bytea not null,
  created_at timestamptz not null default now()
);
alter table econ_private.roblox_server_key enable row level security;
revoke all on table econ_private.roblox_server_key from public, anon, authenticated;

-- A new server key: stores its sha256 and returns the key, once. Only from the SQL editor.
create or replace function public.roblox_new_secret()
returns text language plpgsql security definer set search_path = '' as $$
declare
  k text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into econ_private.roblox_server_key (id, key_hash, created_at) values (1, sha256(convert_to(k, 'UTF8')), now())
    on conflict (id) do update set key_hash = excluded.key_hash, created_at = excluded.created_at;
  return k;
end $$;
revoke all on function public.roblox_new_secret() from public, anon, authenticated;

create or replace function public.roblox_link_code()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  v_code text;
  linked bigint;
begin
  if me is null then raise exception 'sign in first'; end if;
  if not exists (select 1 from public.game_saves where owner_id = me) then raise exception 'no saved town'; end if;
  delete from public.roblox_link_codes where owner_id = me and used_at is null;
  delete from public.roblox_link_codes where (used_at is not null or expires_at < now()) and created_at < now() - interval '1 day';
  loop
    raw := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(abc, (get_byte(raw, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.roblox_link_codes where code = v_code);
  end loop;
  insert into public.roblox_link_codes (code, owner_id) values (v_code, me);
  select roblox_user_id into linked from public.roblox_links where owner_id = me;
  return jsonb_build_object('code', v_code, 'minutes', 15, 'linked', linked is not null);
end $$;

create or replace function public.roblox_claim(p_code text, p_roblox_user bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.roblox_link_codes;
  linked bigint;
  st jsonb;
  paid jsonb;
  k text := current_setting('request.headers', true)::json ->> 'x-cartopia-key';
begin
  -- Only the Roblox game server, which holds the key, may claim.
  if k is null or not exists (select 1 from econ_private.roblox_server_key s where s.key_hash = sha256(convert_to(k, 'UTF8'))) then
    return jsonb_build_object('error', 'server');
  end if;
  if p_code is null or p_roblox_user is null or p_roblox_user <= 0 then return jsonb_build_object('error', 'code'); end if;
  select * into c from public.roblox_link_codes
   where code = upper(btrim(p_code)) and used_at is null and expires_at > now()
   for update;
  if not found then return jsonb_build_object('error', 'code'); end if;
  select roblox_user_id into linked from public.roblox_links where owner_id = c.owner_id;
  if linked is not null and linked <> p_roblox_user then return jsonb_build_object('error', 'other'); end if;
  select state into st from public.game_saves where owner_id = c.owner_id;
  if st is null then return jsonb_build_object('error', 'code'); end if;
  update public.roblox_link_codes set used_at = now() where code = c.code;
  insert into public.roblox_links (owner_id, roblox_user_id) values (c.owner_id, p_roblox_user)
    on conflict (owner_id) do update set synced_at = now();
  select coalesce(jsonb_agg(jsonb_build_object('seq', p.seq, 'bucks', p.bucks, 'coins', p.coins, 'parts', p.parts, 'car', p.car) order by p.seq), '[]'::jsonb)
    into paid from public.purchases p where p.owner_id = c.owner_id and p.reversed_at is null;
  return jsonb_build_object('state', st, 'paid', paid);
end $$;

-- Unlinks the signed-in player's Roblox account, so a new code can link a different Roblox player.
create or replace function public.roblox_unlink()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n int;
begin
  if me is null then raise exception 'sign in first'; end if;
  delete from public.roblox_link_codes where owner_id = me and used_at is null;
  delete from public.roblox_links where owner_id = me;
  get diagnostics n = row_count;
  return jsonb_build_object('unlinked', n > 0);
end $$;

create or replace function public.roblox_link_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('linked', l.owner_id is not null, 'roblox_user_id', l.roblox_user_id, 'linked_at', l.linked_at)
  from (select 1) one left join public.roblox_links l on l.owner_id = auth.uid()
$$;

revoke all on function public.roblox_link_code(), public.roblox_unlink(), public.roblox_link_status() from public, anon;
grant execute on function public.roblox_link_code(), public.roblox_unlink(), public.roblox_link_status() to authenticated;
revoke all on function public.roblox_claim(text, bigint) from public, authenticated;
grant execute on function public.roblox_claim(text, bigint) to anon;

-- The new server key: copy it from the result below into Roblox (Secrets, CARTOPIA_LINK_KEY).
select public.roblox_new_secret() as cartopia_link_key;
