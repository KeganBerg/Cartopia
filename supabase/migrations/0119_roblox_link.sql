-- 0119 Roblox link codes (2026-10-19; "Buy-in" thread in the Cartopia Roblox project).
-- A player carries the progress they earned on the web into the Roblox game. The web game makes a
-- one-time code (roblox_link_code, signed in); the player types it into Settings in Roblox, and the
-- Roblox game server trades it for the town (roblox_claim, as anon with the publishable key).
-- Roblox's rules don't let things bought off Roblox unlock anything in Roblox, so the claim also
-- returns the account's paid packs (purchases not reversed): the Roblox server takes those gems,
-- coins, parts and pack cars back out before the town loads there.
-- One Roblox account per web account: a code from an account already linked to another Roblox
-- player is refused. Codes last 15 minutes and work once.

create table if not exists public.roblox_link_codes (
  code text primary key,
  owner_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz
);
create index if not exists roblox_link_codes_owner on public.roblox_link_codes (owner_id);

create table if not exists public.roblox_links (
  owner_id uuid primary key references auth.users on delete cascade,
  roblox_user_id bigint not null,
  linked_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

alter table public.roblox_link_codes enable row level security;
alter table public.roblox_links enable row level security;
revoke all on table public.roblox_link_codes from anon, authenticated;
revoke all on table public.roblox_links from anon, authenticated;

-- A fresh code for the signed-in player (any older unused code of theirs is used up).
-- Letters and digits that can't be mixed up (no I, O, 0, 1), from gen_random_uuid's random bytes.
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
  update public.roblox_link_codes set used_at = now() where owner_id = me and used_at is null;
  loop
    raw := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
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

-- Called by the Roblox game server. Uses the code up and returns the town and its paid packs, or
-- { error } ('code' for a wrong, used or expired code, 'other' when the web account is linked to a
-- different Roblox player).
create or replace function public.roblox_claim(p_code text, p_roblox_user bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.roblox_link_codes;
  linked bigint;
  st jsonb;
  paid jsonb;
begin
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

revoke all on function public.roblox_link_code() from public, anon;
grant execute on function public.roblox_link_code() to authenticated;
revoke all on function public.roblox_claim(text, bigint) from public, authenticated;
grant execute on function public.roblox_claim(text, bigint) to anon;
