-- Whole-game save per player, plus public summary columns rivals race against.
create table public.game_saves (
  owner_id uuid primary key references auth.users on delete cascade,
  state jsonb not null,
  town_name text not null default 'My Town',
  level integer not null default 1,
  best_car jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_saves enable row level security;

create policy "saves readable by all" on public.game_saves for select using (true);
create policy "insert own save" on public.game_saves for insert with check (auth.uid() = owner_id);
create policy "update own save" on public.game_saves for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
