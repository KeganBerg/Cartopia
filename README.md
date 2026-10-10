# Cartopia

A browser game inspired by Car Town Streets: build a town in a bird's-eye 3D view, collect, upgrade and unlock cars that drive around it, and race other players.

## Stack

- Vite + React + TypeScript
- Three.js via React Three Fiber and drei for the 3D town
- Supabase for auth, database and realtime racing
- Netlify for hosting

## Local dev

```sh
npm install
cp .env.example .env.local   # fill in Supabase URL and anon key (optional; the town renders without them)
npm run dev
```

## How it plays

- Tap a business to start a job. Jobs cost fuel, which refills 1 per minute; Gas Stations raise the cap.
- When the coin bubble appears, tap it to collect coins, XP and sometimes parts.
- Buy cars in the Showroom. Every car you own drives around your roads.
- Upgrade engine, turbo, tires and weight in the Garage with coins and parts.
- Drag race rivals (and real players' best cars once signed in) for coins and trophies.
- Level up to unlock new businesses and cars. Edit mode lays roads and bulldozes.

## Layout

- `src/game/data.ts` building and car catalogs, progression curve
- `src/game/store.ts` game state and actions (zustand, saved to localStorage)
- `src/scene/` 3D town, building and car models, cars driving the road graph
- `src/ui/` HUD, shop, showroom, garage, drag race, account
- `src/lib/cloud.ts` Supabase save sync (newest save wins)
- `supabase/migrations/` database schema
- `netlify.toml` build and SPA redirect config
