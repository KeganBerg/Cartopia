-- Initial schema for Cartopia.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  coins integer not null default 500,
  xp integer not null default 0,
  created_at timestamptz not null default now()
);

-- Catalog of cars a player can unlock.
create table public.car_models (
  id text primary key,
  name text not null,
  unlock_level integer not null default 1,
  price integer not null default 0,
  base_speed numeric not null default 1
);

-- Cars a player owns, with their upgrade level.
create table public.garage_cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  model_id text not null references public.car_models,
  upgrade_level integer not null default 0,
  color text,
  created_at timestamptz not null default now()
);

-- One row per placed building or road tile in a player's town.
create table public.town_tiles (
  owner_id uuid not null references public.profiles on delete cascade,
  x integer not null,
  z integer not null,
  kind text not null,
  primary key (owner_id, x, z)
);

alter table public.profiles enable row level security;
alter table public.car_models enable row level security;
alter table public.garage_cars enable row level security;
alter table public.town_tiles enable row level security;

create policy "profiles readable by all" on public.profiles for select using (true);
create policy "own profile writable" on public.profiles for update using (auth.uid() = id);
create policy "car catalog readable by all" on public.car_models for select using (true);
create policy "own garage" on public.garage_cars for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "towns readable by all" on public.town_tiles for select using (true);
create policy "own town writable" on public.town_tiles for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Create a profile row automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
