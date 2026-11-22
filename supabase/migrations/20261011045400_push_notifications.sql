-- Push alerts ("jobs done", "fuel full") that reach players after they close the game.
-- The browser hands each device a push subscription; the game stores it here, and when
-- the tab is hidden it tells the server when its next alerts are due. The Netlify
-- scheduled function push-send takes due alerts once a minute and sends them.
-- Standalone: does not touch econ_catalog()/econ_guard().

create table if not exists public.push_subscriptions (
  endpoint text primary key check (length(endpoint) between 10 and 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

create table if not exists public.push_alerts (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('jobs', 'restore', 'fuel')),
  send_at timestamptz not null,
  title text not null check (length(title) <= 60),
  body text not null check (length(body) <= 140),
  primary key (user_id, kind)
);
create index if not exists push_alerts_due on public.push_alerts (send_at);

-- Only the functions below touch these tables.
alter table public.push_subscriptions enable row level security;
alter table public.push_alerts enable row level security;
revoke all on public.push_subscriptions, public.push_alerts from anon, authenticated;

-- Saves this device's subscription for the signed-in player (a shared browser moves to whoever
-- signed in last). Keeps each player's 10 newest devices.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_endpoint !~ '^https://' then raise exception 'bad endpoint'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, updated_at)
  values (p_endpoint, uid, p_p256dh, p_auth, now())
  on conflict (endpoint) do update set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, updated_at = now();
  delete from public.push_subscriptions where user_id = uid and endpoint not in (
    select endpoint from public.push_subscriptions where user_id = uid order by updated_at desc limit 10);
end $$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Replaces the player's pending alerts: [{kind, at (ms since epoch), title, body}].
-- An empty list cancels them (the game does that when the player comes back).
create or replace function public.push_set_alerts(p_alerts jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_alerts) <> 'array' or jsonb_array_length(p_alerts) > 3 then raise exception 'bad alerts'; end if;
  delete from public.push_alerts where user_id = uid;
  insert into public.push_alerts (user_id, kind, send_at, title, body)
  select distinct on (a->>'kind') uid, a->>'kind', to_timestamp((a->>'at')::double precision / 1000), left(a->>'title', 60), left(a->>'body', 140)
  from jsonb_array_elements(p_alerts) a
  where to_timestamp((a->>'at')::double precision / 1000) between now() and now() + interval '7 days';
end $$;

-- For the sender only: removes the alerts that are due and returns them with every device to
-- send them to. Alerts more than 30 minutes late are dropped rather than sent.
create or replace function public.push_take_due()
returns table (kind text, title text, body text, endpoint text, p256dh text, auth text)
language sql security definer set search_path = '' as $$
  with due as (
    delete from public.push_alerts where send_at <= now() returning *
  )
  select d.kind, d.title, d.body, s.endpoint, s.p256dh, s.auth
  from due d join public.push_subscriptions s on s.user_id = d.user_id
  where d.send_at > now() - interval '30 minutes';
$$;

revoke all on function public.push_subscribe(text, text, text), public.push_unsubscribe(text),
  public.push_set_alerts(jsonb), public.push_take_due() from public, anon, authenticated;
grant execute on function public.push_subscribe(text, text, text), public.push_unsubscribe(text),
  public.push_set_alerts(jsonb) to authenticated;
grant execute on function public.push_take_due() to service_role;
-- The sender also drops subscriptions the push service says are gone.
grant select, delete on public.push_subscriptions to service_role;
