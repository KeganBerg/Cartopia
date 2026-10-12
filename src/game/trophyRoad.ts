// Trophy Road: every ROAD_STEP trophies is a stop with a prize that can't be bought: a paint
// colour (data.ts PAINTS with earn 'road', for the body, a panel or the wheels), a pattern
// (PATTERNS with road), or coins and parts every fourth stop. Past the last stop, every step
// pays ROAD_AFTER. Trophies are never spent: the save keeps how many stops were claimed
// (`road`). The server guard (econ_guard(), catalog key `road`) pays the same coins and parts
// and won't let a claim run past the trophies.
import { PAINTS } from './data'

export const ROAD_STEP = 25
export type RoadPrize = { paint?: string; pattern?: string; coins?: number; parts?: number }

const roadPaint = (name: string) => {
  const p = PAINTS.find((x) => x.name === name && x.earn === 'road')
  if (!p) throw new Error(`no road paint ${name}`)
  return p.color
}

export const ROAD: RoadPrize[] = [
  { paint: roadPaint('Mint') },
  { pattern: 'pinstripe' },
  { paint: roadPaint('Peach') },
  { coins: 10000, parts: 25 },
  { paint: roadPaint('Cobalt') },
  { paint: roadPaint('Rose Gold') },
  { pattern: 'polka' },
  { coins: 20000, parts: 50 },
  { paint: roadPaint('Lemon') },
  { paint: roadPaint('Plum') },
  { paint: roadPaint('Tangerine') },
  { coins: 30000, parts: 75 },
  { paint: roadPaint('Gunmetal') },
  { paint: roadPaint('Sea Glass') },
  { paint: roadPaint('Cherry') },
  { coins: 40000, parts: 100 },
]
export const ROAD_AFTER: RoadPrize = { coins: 5000, parts: 15 }

// The prize at stop i (0-based: stop 0 is at ROAD_STEP trophies).
export const roadPrize = (i: number): RoadPrize => ROAD[i] ?? ROAD_AFTER
export const roadTrophies = (i: number) => (i + 1) * ROAD_STEP
// How many stops these trophies reach.
export const roadReached = (trophies: number) => Math.max(0, Math.floor(trophies / ROAD_STEP))

// Is a paint or pattern from the road already won?
export const roadPaintIndex = (color: string) => ROAD.findIndex((p) => p.paint === color)
export const roadPatternIndex = (id: string) => ROAD.findIndex((p) => p.pattern === id)
export const roadOpen = (claimed: number | undefined, i: number) => i >= 0 && (claimed ?? 0) > i
