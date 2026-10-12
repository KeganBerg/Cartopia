# Exotic cars

Top-tier, hard-to-get cars (Veloce Fulmine, Moreau Eclat, Aurelio Orafo) whose shapes the
extruded side profiles in `CarModel.tsx` can't make: wedges that narrow to the nose, fenders
standing above the hood, teardrop canopies. They never replace an existing car; each is a new
car id on its own body.

- `src/scene/loft.ts` lofts a body through hand-drawn half cross-sections. Points marked hard
  make a crease the length of the car; the rest is smooth, so panels read as clean planes
  with crisp edges.
- `src/scene/exoticCars.ts` draws each body (`EXOTIC` maps body to builder) and details it with
  the same parts every car uses (paint, black, chrome, glass, lamp...), so town traffic still
  bakes it into two meshes and the garage draws it in the usual dozen.
- Every shape is our own drawing. No outside 3D model is used or shipped, and names are invented.

## Adding one

1. Add the body to `Body` (data.ts), a `SHAPES` entry in CarModel.tsx (wheel size and spot,
   and where mods mount) and a `BODY` engine sound in `src/lib/engineAudio.ts`.
2. Write its builder in exoticCars.ts and add it to `EXOTIC`; add the car to `CARS` and a
   wheel look to `STYLES` in carTrim.ts.
3. Check it next to the existing cars: `npm run dev`, then
   `node scripts/exotics/shoot.mjs out.png lambo,sovereign,<id> 34,side,rear 2400 1200 "&cols=3"`,
   and in game with `node scripts/exotics/ingame.mjs out <id> <colour>`.
4. `npx vitest run src/scene/exoticCars.test.ts` checks its size, cost and parts.
5. New catalog cars need the economy thread's catalog and crate SQL, run after the client ships.
