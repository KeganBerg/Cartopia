# Resto-mod cars

Secret cars that are never sold: Valtorre Sprint 65 (Lv 10), Liberty Revenant '69 (Lv 14) and
Corvara Pontone 58 (Lv 18). Each comes in four crate pieces (Body, Engine, Wheels, Interior); the
fourth piece builds the car. A piece you already have pays coins, and a built car drops no more
pieces. Pieces of a car start dropping at its level.

- Odds: the 🧩 slice is 2% of Garage, 3% of Gold and 4% of Diamond opens (`piece` in `CRATES`).
- Code: `src/game/resto.ts` (pieces, pool), `rollCrate` in `src/game/crates.ts`, the 2x2 build
  card `src/ui/Resto.tsx`, bodies in `src/scene/restoCars.ts` (lofted like the exotics).
- Server: `supabase/migrations/0065_resto_pieces.sql`. Pieces are counted from `crate_opens`,
  so the save's `restoParts` is only a mirror. The catalog lists resto cars at unlock 999 so the
  guard refunds any copy the server didn't build (`car_granted`).
- Adding one: a car with `secret: true` in `CARS`, a body in `RESTO`, a set entry, splash renders
  (`scripts/splash/shoot.mjs car-<id>` and `hero-<id>`), then regenerate the catalog and crate SQL.
- Screenshots: `node scripts/resto/shots.mjs out` with `npm run dev`.
