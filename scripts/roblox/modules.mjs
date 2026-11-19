// Modules whose plain data the Roblox export copies. Pure game rules live in src/game;
// the few scene files listed hold car shapes, skins and venue data rather than rendering.
import { readdirSync } from 'node:fs'

const game = readdirSync('src/game')
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => `src/game/${f}`)

export const MODULES = [
  ...game,
  'src/scene/carLooks.ts',
  'src/scene/skins.ts',
  'src/scene/venues.ts',
  'src/scene/exoticCars.ts',
  'src/scene/restoCars.ts',
  'src/scene/oddballCars.ts',
  'src/scene/packCars.ts',
  'src/scene/season.ts',
  'src/scene/speedwayLayout.ts',
]
