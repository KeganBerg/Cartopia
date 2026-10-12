-- Friendly ghost race reactions (2026-10-12): adds "Nice race! 👏" (id 14) next to "GG! 🤝" (id 10)
-- as a good-sport taunt anyone can send, win or lose. TAUNTS in src/lib/ghosts.ts lists the same ids;
-- ghosts.test.ts checks them against the newest copy of this function.
-- Players can also mute received taunts in Settings (a device-only preference, nothing on the server).
-- Standalone: no change to econ_catalog() or econ_guard(), and no prizes.
-- Run it BEFORE the client ships: until then the server turns down id 14 and the game says it couldn't send.

create or replace function public.ghost_taunt_ids() returns jsonb
language sql immutable set search_path = '' as $$
-- taunts:begin
select $taunts${"brag":[0,1,2,3,4,5],"any":[10,14,11,12,13]}$taunts$::jsonb
-- taunts:end
$$;

revoke execute on function public.ghost_taunt_ids() from public, anon;
