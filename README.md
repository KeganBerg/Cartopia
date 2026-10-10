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

## Layout

- `src/game/` town grid, buildings and driving cars
- `src/lib/supabase.ts` Supabase client
- `supabase/migrations/` database schema
- `netlify.toml` build and SPA redirect config
