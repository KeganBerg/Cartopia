# Two-player tests

Live races, wagers and crew races need two signed-in players. These scripts give them a private
copy of the game server, so nothing touches the real Supabase project or anyone's save.

- `server-check.sh` (`npm run check:server`, runs in CI): every migration on a brand-new Postgres,
  then `server-check.sql` plays the server side as signed-in players: race referee, private race
  channels, wager holds, payouts, refunds, daily caps, the too-fast-win check, forfeits and crew
  battle points. A few seconds.
- `stack.sh up`: the same database plus PostgREST, `gateway.mjs` (password sign-in and a Realtime
  websocket with broadcast, presence and private-channel checks run against the real
  `realtime.messages` policies) and vite pointed at it, on http://127.0.0.1:5199/. `stack.sh down` stops it.
- `play.mjs` (`npm run twoplayer` does both): two browsers, a desktop window and a phone-sized
  touch screen, sign in as two fresh local accounts and play: lobby, decline, cancel, a live race,
  a 2K bet with payout, a bet called off when the challenger's connection drops, a crew ladder live
  race and a crewmate ghost race. Prints PASS/FAIL per check, screenshots every step to `--out`.
  `--swap` flips which player is on the phone; `--only lobby,race,wager,void,crew` picks parts.

In a container without a GPU the game draws about one frame a second, so a full `play.mjs` run takes
a while (each race a few minutes). Buttons are pressed with DOM clicks and the race is driven from
inside the page (space bar on each green light), because real pointer input waits on frames there.
To keep inside the 45 s challenge window the town behind the menus is not drawn (as a covering menu
does on a phone), and the two racing pages are kept level, since a race runs on frames and the
slower page would otherwise finish minutes later and lose by forfeit.

Run `play.mjs` against a vite that is not being edited: a hot reload of `src/lib/live.ts` gives the
script's in-page imports a different copy of the module from the game's.
